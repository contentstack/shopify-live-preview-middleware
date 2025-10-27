# Testing Documentation

This directory contains the test suite for the Shopify Live Preview Middleware service.

## Test Structure

- `config.test.ts` - Configuration module tests
- `githubSync.test.ts` - GitHub sync logic tests  
- `environment.test.ts` - Environment utilities tests
- `setup.ts` - Global test setup

## Running Tests

### Basic Commands
- `npm test` - Run all tests
- `npm run test:coverage` - Run tests with coverage
- `npm run test:watch` - Run tests in watch mode
- `npm run test:verbose` - Run tests with verbose output

### Specific Tests
- `npm run test:config` - Run config tests only
- `npm run test:github` - Run GitHub sync tests only

## Current Coverage

✅ **Configuration Module** - Fully tested
✅ **GitHub Sync Logic** - Business logic tested
✅ **Environment Utilities** - Utility functions tested

⚠️ **Controllers & Routes** - Need integration testing

## Test Patterns

Tests follow Jest conventions with describe/it blocks and focus on:
- Input validation
- Error handling
- Business logic
- Edge cases

## Configuration

- Jest config: `jest.config.cjs`
- TypeScript config: `tsconfig.test.json`
- Test setup: `tests/setup.ts` 