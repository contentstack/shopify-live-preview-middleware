interface Config {
  port: number;
  host: string;
  nodeEnv: string;
  contentstack: {
    deliveryToken: string;
    previewToken: string;
    environment: string;
    apiKey: string;
    previewUrl?: string;
    rateLimit?: {
      max: number;
      timeWindow: string;
    };
  };
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3002', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  contentstack: {
    deliveryToken: process.env.CONTENTSTACK_DELIVERY_TOKEN || '',
    previewToken: process.env.CONTENTSTACK_PREVIEW_TOKEN || '',
    environment: process.env.CONTENTSTACK_ENVIRONMENT || '',
    apiKey: process.env.CONTENTSTACK_API_KEY || '',
    previewUrl: process.env.CONTENTSTACK_PREVIEW_URL || 'https://rest-preview.contentstack.com',
    rateLimit: {
      // Set the maximum number of requests allowed per time window.
      // Tries to read RATE_LIMIT_MAX from environment variables, falls back to 100 if not set or not a valid number.
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10) || 100,
      timeWindow: process.env.RATE_LIMIT_TIME_WINDOW || '1 minute',
    },
  },
}; 