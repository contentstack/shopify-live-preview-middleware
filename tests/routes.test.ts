import { Writable } from 'stream';
import type { FastifyInstance } from 'fastify';
import { buildServer, logUnhandledRejections } from '../src/app.js';

// Only /health and /get-preview-data are served; the removed routes must be plain 404s.
describe('route table', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns ok with an ISO timestamp', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it.each([
    ['GET', '/health/views'],
    ['POST', '/sync-github-repo'],
    ['GET', '/documentation'],
    ['GET', '/documentation/json'],
  ])('%s %s is not served', async (method, url) => {
    const res = await app.inject({ method: method as 'GET' | 'POST', url });

    expect(res.statusCode).toBe(404);
  });

  // A new route fails here until this list is updated on purpose; OPTIONS * is the CORS preflight.
  it('serves exactly the expected routes', () => {
    expect(app.printRoutes({ commonPrefix: false }).trim()).toBe(
      ['├── /health (GET, HEAD)', '├── /get-preview-data (POST)', '└── * (OPTIONS)'].join('\n')
    );
  });

  // No cookies are used, so cross-origin callers must not be allowed to send them.
  it('does not allow credentials on cross-origin requests', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/get-preview-data',
      headers: { origin: 'https://example.com', 'access-control-request-method': 'POST' },
    });

    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

// Routes registered before the rate-limit plugin loaded used to miss its hook and were never limited.
describe('rate limiting', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ['GET', '/health'],
    ['POST', '/get-preview-data'],
  ])('%s %s returns 429 after 100 requests in a window', async (method, url) => {
    const send = () => app.inject({ method: method as 'GET' | 'POST', url, payload: method === 'POST' ? {} : undefined });

    const first = await send();
    expect(first.statusCode).not.toBe(429);
    expect(first.headers['x-ratelimit-limit']).toBe('100');

    for (let i = 1; i < 100; i++) await send();

    const over = await send();
    expect(over.statusCode).toBe(429);
    expect(over.json().message).toBe('Rate limit exceeded. Please try again later.');
  });

  // On Launch every request arrives from loopback, with the client IP in x-forwarded-for.
  const fromLaunch = (clientIp: string) =>
    app.inject({ method: 'GET', url: '/health', remoteAddress: '127.0.0.1', headers: { 'x-forwarded-for': clientIp } });

  it('keys clients behind the Launch proxy on x-forwarded-for, not the loopback address', async () => {
    for (let i = 0; i < 100; i++) await fromLaunch('198.51.100.1');
    expect((await fromLaunch('198.51.100.1')).statusCode).toBe(429);

    expect((await fromLaunch('198.51.100.2')).statusCode).not.toBe(429);
  });

  it('ignores x-forwarded-for from a caller that is not on loopback', async () => {
    const forged = (i: number) =>
      app.inject({ method: 'GET', url: '/health', remoteAddress: '203.0.113.5', headers: { 'x-forwarded-for': `198.51.100.${i % 250}` } });

    for (let i = 0; i < 100; i++) await forged(i);
    expect((await forged(100)).statusCode).toBe(429);
  });
});

// SDK 1.1.6 leaves multi-reference fetches unawaited, so a failed one surfaces as an unhandled rejection.
describe('unhandled rejections', () => {
  it('logs the message instead of leaving the default handler to exit the process', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const app = buildServer({ logger: { level: 'error', stream } as any });
    const before = process.listeners('unhandledRejection');

    logUnhandledRejections(app);
    const added = process.listeners('unhandledRejection').filter((l) => !before.includes(l));
    try {
      expect(added).toHaveLength(1);
      added[0](new Error('The requested entry does not exist.'), Promise.resolve());

      expect(lines.map((line) => JSON.parse(line))).toEqual([
        expect.objectContaining({ msg: 'unhandled rejection', err: 'The requested entry does not exist.' }),
      ]);
    } finally {
      added.forEach((l) => process.off('unhandledRejection', l));
      await app.close();
    }
  });
});
