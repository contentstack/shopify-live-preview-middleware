// Own file per the one-permutation-per-file rule (see config.defaults.test.ts).
// Permutation: both numeric env vars set to unparseable strings.
const originalEnv = { ...process.env };

process.env.PORT = 'abc';
process.env.RATE_LIMIT_MAX = 'abc';

let config: any;

beforeAll(async () => {
  ({ config } = await import('../src/config.js'));
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Config (unparseable numeric env values)', () => {
  // parseInt('abc') is NaN and there is no `|| 3002` guard on port, unlike rateLimit.max.
  // Documented, not endorsed: a typo'd PORT yields NaN rather than the default.
  it('yields NaN for an unparseable PORT rather than falling back to 3002', () => {
    expect(config.port).toBeNaN();
  });

  // rateLimit.max DOES have a `|| 100` guard, so NaN is caught here.
  it('falls back to a rate limit of 100 for an unparseable RATE_LIMIT_MAX', () => {
    expect(config.contentstack.rateLimit.max).toBe(100);
  });
});
