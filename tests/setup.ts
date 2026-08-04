// Global test setup

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3003';
process.env.HOST = 'localhost';

// The controller constructs a ContentstackService at import time, and that constructor
// throws on any empty credential — so these must be set before any suite imports the app.
process.env.CONTENTSTACK_DELIVERY_TOKEN = 'test-delivery-token';
process.env.CONTENTSTACK_PREVIEW_TOKEN = 'test-preview-token';
process.env.CONTENTSTACK_ENVIRONMENT = 'test-environment';
process.env.CONTENTSTACK_API_KEY = 'test-api-key';
