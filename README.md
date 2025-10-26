# Shopify Live Preview Middleware

A middleware service for handling Shopify live preview functionality with Contentstack integration.

## Features

- Built with Fastify for high performance
- TypeScript support
- API documentation with Swagger
- CORS enabled
- Environment configuration
- Structured logging with pino
- Contentstack live preview integration

## Prerequisites

- Node.js (v20 or later)
- npm or yarn
- Contentstack account with API credentials

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd live-preview-shopify-middleware
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory with your Contentstack credentials:
```bash
# Server Configuration
PORT=3002
HOST=0.0.0.0
NODE_ENV=development

# Contentstack Configuration (Required)
CONTENTSTACK_DELIVERY_TOKEN=your_delivery_token_here
CONTENTSTACK_PREVIEW_TOKEN=your_preview_token_here
CONTENTSTACK_ENVIRONMENT=your_environment_here
CONTENTSTACK_API_KEY=your_api_key_here
CONTENTSTACK_PREVIEW_URL=https://api.contentstack.io
```

You can copy the example file and modify it:
```bash
cp .env.example .env
```

## Configuration

### Required Environment Variables

The following environment variables are required for the middleware to function properly:

- `CONTENTSTACK_DELIVERY_TOKEN`: Your Contentstack delivery token
- `CONTENTSTACK_PREVIEW_TOKEN`: Your Contentstack preview token  
- `CONTENTSTACK_ENVIRONMENT`: Your Contentstack environment (e.g., 'development', 'production')
- `CONTENTSTACK_API_KEY`: Your Contentstack API key

### Optional Environment Variables

- `CONTENTSTACK_PREVIEW_URL`: Contentstack preview URL (defaults to 'https://api.contentstack.io')
- `PORT`: Server port (defaults to 3002)
- `HOST`: Server host (defaults to '0.0.0.0')
- `NODE_ENV`: Node environment (defaults to 'development')

## Development

To start the development server with hot-reload:

```bash
npm run dev
# or
yarn dev
```

## Build and Production

To build the project:

```bash
npm run build
# or
yarn build
```

To start the production server:

```bash
npm start
# or
yarn start
```

## API Documentation

Once the server is running, you can access the Swagger documentation at:

```
http://localhost:3002/documentation
```

## Troubleshooting

### "LivePreviewShopify is not configured" Error

This error occurs when the required Contentstack environment variables are not set. Make sure you have:

1. Created a `.env` file with all required Contentstack credentials
2. Set the environment variables in your deployment environment
3. Verified that the credentials are correct and have the necessary permissions

### "fetchData is not a function" Error

This error was resolved by updating the LivePreviewShopify class to properly handle configuration. Make sure you're using the latest version of the `@contentstack/shopify-live-preview-sdk` package.

## Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build the project
- `npm start` - Start the production server
- `npm run test` - Run tests
- `npm run lint` - Run linting
- `npm run format` - Format code with Prettier

## License

MIT 
