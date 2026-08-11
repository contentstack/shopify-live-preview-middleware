import { jest } from '@jest/globals';

// config.ts snapshots process.env once, at import time, so every env permutation needs a
// fresh module instance. resetModules() drops the cached one and the dynamic import below
// re-runs the module body against whatever env the case just installed.
//
// Note the `@jest/globals` import above: under native ESM the `jest` object is not injected
// as a global, so calling jest.resetModules() without it throws "jest is not defined".
const baseEnv = { ...process.env };

const CONFIG_ENV_VARS = [
  'PORT',
  'HOST',
  'NODE_ENV',
  'CONTENTSTACK_DELIVERY_TOKEN',
  'CONTENTSTACK_PREVIEW_TOKEN',
  'CONTENTSTACK_ENVIRONMENT',
  'CONTENTSTACK_API_KEY',
  'CONTENTSTACK_PREVIEW_URL',
  'RATE_LIMIT_MAX',
  'RATE_LIMIT_TIME_WINDOW',
];

type LoadedConfig = (typeof import('../src/config.js'))['config'];

/** Loads config.ts fresh, with `overrides` applied on top of the env tests/setup.ts installs. */
const loadConfig = async (overrides: Record<string, string> = {}): Promise<LoadedConfig> => {
  process.env = { ...baseEnv, ...overrides };
  jest.resetModules();
  return (await import('../src/config.js')).config;
};

/** Loads config.ts fresh with every var it reads removed, to pin the hardcoded fallbacks. */
const loadConfigWithNoEnv = async (): Promise<LoadedConfig> => {
  process.env = { ...baseEnv };
  for (const key of CONFIG_ENV_VARS) delete process.env[key];
  jest.resetModules();
  return (await import('../src/config.js')).config;
};

afterAll(() => {
  process.env = baseEnv;
});

describe('config', () => {
  describe('default test env', () => {
    let config: LoadedConfig;
    beforeAll(async () => {
      config = await loadConfig();
    });

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

  describe('no env set', () => {
    let config: LoadedConfig;
    beforeAll(async () => {
      config = await loadConfigWithNoEnv();
    });

    it('defaults port to 3002', () => {
      expect(config.port).toBe(3002);
    });

    it('defaults host to 0.0.0.0', () => {
      expect(config.host).toBe('0.0.0.0');
    });

    it('defaults nodeEnv to development', () => {
      expect(config.nodeEnv).toBe('development');
    });

    it('defaults the preview URL to the hosted REST preview host', () => {
      expect(config.contentstack.previewUrl).toBe('https://rest-preview.contentstack.com');
    });

    it('defaults the rate limit to 100 requests per minute', () => {
      expect(config.contentstack.rateLimit).toEqual({ max: 100, timeWindow: '1 minute' });
    });

    // Documents the empty-string fallback: config.ts does NOT throw on missing
    // credentials. The failure surfaces later, when ContentstackService is constructed.
    it('falls back to empty strings for missing contentstack credentials', () => {
      expect(config.contentstack).toMatchObject({
        deliveryToken: '',
        previewToken: '',
        environment: '',
        apiKey: '',
      });
    });
  });

  describe('unparseable numeric env values', () => {
    let config: LoadedConfig;
    beforeAll(async () => {
      config = await loadConfig({ PORT: 'abc', RATE_LIMIT_MAX: 'abc' });
    });

    // parseInt('abc') is NaN and there is no `|| 3002` guard on port, unlike rateLimit.max.
    // Documented, not endorsed: a typo'd PORT yields NaN rather than the default.
    it('yields NaN for an unparseable PORT rather than falling back to 3002', () => {
      expect(config.port).toBeNaN();
    });

    // rateLimit.max DOES have a `|| 100` guard, so NaN is caught here.
    it('falls back to a rate limit of 100 for an unparseable RATE_LIMIT_MAX', () => {
      expect(config.contentstack.rateLimit?.max).toBe(100);
    });
  });

  describe('negative rate limit', () => {
    let config: LoadedConfig;
    beforeAll(async () => {
      config = await loadConfig({ RATE_LIMIT_MAX: '-5', RATE_LIMIT_TIME_WINDOW: '30 seconds' });
    });

    // Documented, not endorsed: -5 is truthy, so the `|| 100` guard does not catch it and
    // a negative max reaches @fastify/rate-limit as-is. No lower bound exists today.
    it('accepts a negative RATE_LIMIT_MAX verbatim', () => {
      expect(config.contentstack.rateLimit?.max).toBe(-5);
    });

    it('reads a custom time window from the environment', () => {
      expect(config.contentstack.rateLimit?.timeWindow).toBe('30 seconds');
    });
  });

  describe('oversized rate limit', () => {
    let config: LoadedConfig;
    beforeAll(async () => {
      config = await loadConfig({ RATE_LIMIT_MAX: '999999999999' });
    });

    // Documented, not endorsed: there is no upper clamp, so an oversized max passes
    // straight through and effectively disables rate limiting.
    it('accepts an oversized RATE_LIMIT_MAX verbatim with no upper clamp', () => {
      expect(config.contentstack.rateLimit?.max).toBe(999999999999);
    });
  });
});
