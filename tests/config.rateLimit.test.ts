// Own file per the one-permutation-per-file rule (see config.defaults.test.ts).
// Permutation: a negative rate limit plus a custom time window.
const originalEnv = { ...process.env };

process.env.RATE_LIMIT_MAX = '-5';
process.env.RATE_LIMIT_TIME_WINDOW = '30 seconds';

let config: any;

beforeAll(async () => {
  ({ config } = await import('../src/config.js'));
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Config (negative rate limit)', () => {
  // Documented, not endorsed: -5 is truthy, so the `|| 100` guard does not catch it and
  // a negative max reaches @fastify/rate-limit as-is. No lower bound exists today.
  it('accepts a negative RATE_LIMIT_MAX verbatim', () => {
    expect(config.contentstack.rateLimit.max).toBe(-5);
  });

  it('reads a custom time window from the environment', () => {
    expect(config.contentstack.rateLimit.timeWindow).toBe('30 seconds');
  });
});
