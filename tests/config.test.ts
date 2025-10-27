import { config } from '../src/config';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should have default port value', () => {
    expect(config.port).toBeDefined();
    expect(typeof config.port).toBe('number');
  });

  it('should have default host value', () => {
    expect(config.host).toBeDefined();
    expect(typeof config.host).toBe('string');
  });

  it('should have default nodeEnv value', () => {
    expect(config.nodeEnv).toBeDefined();
    expect(typeof config.nodeEnv).toBe('string');
  });

  it('should parse port as number', () => {
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThan(65536);
  });
}); 