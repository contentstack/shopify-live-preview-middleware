import { config } from '../src/config.js';

// This file covers the DEFAULT test env — the values tests/setup.ts installs.
// No per-case module reset here: config.ts reads env once at import, and under native
// ESM there is no registry reset that would re-run it. Anything needing a different
// env permutation lives in its own file (config.defaults / config.rateLimit /
// config.invalidNumbers / config.oversizedRateLimit).
describe('Config (default test env)', () => {
  it('reads port from the environment as a number', () => {
    expect(typeof config.port).toBe('number');
    expect(config.port).toBe(3003); // set by tests/setup.ts
  });

  it('parses port into a valid TCP range', () => {
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThan(65536);
  });

  it('reads host from the environment', () => {
    expect(config.host).toBe('localhost'); // set by tests/setup.ts
  });

  it('reads nodeEnv from the environment', () => {
    expect(config.nodeEnv).toBe('test'); // set by tests/setup.ts
  });

  it('exposes the contentstack credentials the controller needs at import', () => {
    expect(config.contentstack).toMatchObject({
      deliveryToken: 'test-delivery-token',
      previewToken: 'test-preview-token',
      environment: 'test-environment',
      apiKey: 'test-api-key',
    });
  });

  it('falls back to the hosted preview URL when CONTENTSTACK_PREVIEW_URL is unset', () => {
    expect(config.contentstack.previewUrl).toBe('https://rest-preview.contentstack.com');
  });

  it('falls back to a rate limit of 100 per minute', () => {
    expect(config.contentstack.rateLimit).toEqual({ max: 100, timeWindow: '1 minute' });
  });
});
