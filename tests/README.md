# Testing Documentation

This directory contains the test suite for the Shopify Live Preview Middleware service.

## Test Structure

- `config.test.ts` - Configuration module tests, one `describe` per env permutation
- `getPreviewData.test.ts` - `getPreviewData` handler tests, driven through `fastify.inject()`
- `setup.ts` - Global test setup (installs the env the controller needs at import time)

## Running Tests

### Basic Commands
- `npm test` - Run all tests
- `npm run test:coverage` - Run tests with coverage
- `npm run test:watch` - Run tests in watch mode
- `npm run test:verbose` - Run tests with verbose output

### Specific Tests
- `npm run test:config` - Run config tests only

## Current Coverage

✅ **Configuration Module** - Fully covered, including the undefended edge cases
✅ **getPreviewData handler** - Success, validation and error paths covered
✅ **Server bootstrap** (`src/app.ts`) - Covered via `buildServer()`

⚠️ **githubSyncController / viewsHealthController** - Not yet covered

## Test Patterns

Tests follow Jest conventions with describe/it blocks and focus on:
- Input validation
- Error handling
- Business logic
- Edge cases

Two conventions worth knowing before adding tests here:

- **Native ESM.** The `jest` object is not injected as a global, so anything needing
  `jest.resetModules()` / `jest.fn()` must `import { jest } from '@jest/globals'` first.
- **Module-level env reads.** `src/config.ts` snapshots `process.env` at import time, so a test
  that needs a different env has to `jest.resetModules()` and re-`import()` the module rather
  than mutate `process.env` and expect the existing `config` object to change.

## Configuration

- Jest config: `jest.config.cjs`
- TypeScript config: `tsconfig.test.json`
- Test setup: `tests/setup.ts`
