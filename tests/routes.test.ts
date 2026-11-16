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
