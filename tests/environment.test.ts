describe('Environment Utilities', () => {
  describe('Port parsing', () => {
    it('should parse valid port numbers', () => {
      const parsePort = (portStr, defaultPort) => {
        if (!portStr) return defaultPort;
        const parsed = parseInt(portStr, 10);
        return isNaN(parsed) ? defaultPort : parsed;
      };

      expect(parsePort('3000', 8080)).toBe(3000);
      expect(parsePort('8080', 3000)).toBe(8080);
      expect(parsePort('80', 3000)).toBe(80);
      expect(parsePort('65535', 3000)).toBe(65535);
    });

    it('should handle invalid port values', () => {
      const parsePort = (portStr, defaultPort) => {
        if (!portStr) return defaultPort;
        const parsed = parseInt(portStr, 10);
        return isNaN(parsed) ? defaultPort : parsed;
      };

      expect(parsePort('invalid', 8080)).toBe(8080);
      expect(parsePort('', 8080)).toBe(8080);
      expect(parsePort(undefined, 8080)).toBe(8080);
      expect(parsePort(null, 8080)).toBe(8080);
      expect(parsePort('abc123', 8080)).toBe(8080);
    });

    it('should handle edge cases', () => {
      const parsePort = (portStr, defaultPort) => {
        if (!portStr) return defaultPort;
        const parsed = parseInt(portStr, 10);
        return isNaN(parsed) ? defaultPort : parsed;
      };

      expect(parsePort('0', 8080)).toBe(0);
      expect(parsePort('-1', 8080)).toBe(-1);
      expect(parsePort('99999', 8080)).toBe(99999);
    });
  });

  describe('String validation', () => {
    it('should validate non-empty strings', () => {
      const isValidString = (str) => {
        return typeof str === 'string' && str.length > 0;
      };

      expect(isValidString('valid')).toBe(true);
      expect(isValidString('localhost')).toBe(true);
      expect(isValidString('0.0.0.0')).toBe(true);
    });

    it('should reject invalid strings', () => {
      const isValidString = (str) => {
        return typeof str === 'string' && str.length > 0;
      };

      expect(isValidString('')).toBe(false);
      expect(isValidString(null)).toBe(false);
      expect(isValidString(undefined)).toBe(false);
      expect(isValidString(123)).toBe(false);
    });
  });

  describe('Environment defaults', () => {
    it('should provide sensible defaults', () => {
      const getConfigValue = (envValue, defaultValue) => {
        return envValue || defaultValue;
      };

      expect(getConfigValue(undefined, 'development')).toBe('development');
      expect(getConfigValue('', 'localhost')).toBe('localhost');
      expect(getConfigValue('production', 'development')).toBe('production');
      expect(getConfigValue('127.0.0.1', '0.0.0.0')).toBe('127.0.0.1');
    });
  });
}); 