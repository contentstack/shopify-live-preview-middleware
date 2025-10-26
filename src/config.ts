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
  },
}; 