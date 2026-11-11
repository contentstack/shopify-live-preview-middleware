import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/app.js';

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
    const res = await app.inject({
      method: method as 'GET' | 'POST',
      url,
      ...(method === 'POST' ? { payload: { authtoken: 'x', repoName: 'a/b' } } : {}),
    });

    expect(res.statusCode).toBe(404);
  });
});
