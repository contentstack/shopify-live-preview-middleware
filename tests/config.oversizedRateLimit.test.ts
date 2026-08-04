// Own file per the one-permutation-per-file rule (see config.defaults.test.ts).
// Permutation: a rate limit far above any sane request volume.
const originalEnv = { ...process.env };

process.env.RATE_LIMIT_MAX = '999999999999';

let config: any;

beforeAll(async () => {
  ({ config } = await import('../src/config.js'));
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Config (oversized rate limit)', () => {
  // Documented, not endorsed: there is no upper clamp, so an oversized max passes
  // straight through and effectively disables rate limiting.
  it('accepts an oversized RATE_LIMIT_MAX verbatim with no upper clamp', () => {
    expect(config.contentstack.rateLimit.max).toBe(999999999999);
  });
});
