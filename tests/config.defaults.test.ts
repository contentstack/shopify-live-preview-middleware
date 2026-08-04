// Its own file on purpose: config.ts reads process.env once at import, and native ESM
// has no registry reset, so one env permutation per file is the isolation boundary.
// Here every var config.ts looks at is REMOVED, to pin the hardcoded fallbacks.
const originalEnv = { ...process.env };

delete process.env.PORT;
delete process.env.HOST;
delete process.env.NODE_ENV;
delete process.env.CONTENTSTACK_DELIVERY_TOKEN;
delete process.env.CONTENTSTACK_PREVIEW_TOKEN;
delete process.env.CONTENTSTACK_ENVIRONMENT;
delete process.env.CONTENTSTACK_API_KEY;
delete process.env.CONTENTSTACK_PREVIEW_URL;
delete process.env.RATE_LIMIT_MAX;
delete process.env.RATE_LIMIT_TIME_WINDOW;

let config: any;

beforeAll(async () => {
  ({ config } = await import('../src/config.js'));
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Config (no env set)', () => {
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
