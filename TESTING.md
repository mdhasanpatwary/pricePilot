# Testing Documentation

## Overview
PricePilot has a comprehensive test suite covering unit tests, integration tests, and load tests.

## Test Structure

```
__tests__/
├── lib/
│   └── services/
│       ├── matching.test.ts      # Unit tests for MatchingService
│       ├── rules-engine.test.ts  # Unit tests for RulesEngine
│       └── scraper.test.ts       # Load tests for ScraperService
└── app/
    └── api/
        └── integrations.test.ts  # Integration tests for API endpoints
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Load Tests Only
```bash
npm run test:load
```

## Test Coverage

### Unit Tests

#### MatchingService (`matching.test.ts`)
- ✅ Exact SKU matching
- ✅ Brand + Model matching
- ✅ Title similarity matching (Levenshtein)
- ✅ Low similarity rejection
- ✅ Low confidence match refresh

**Coverage**: 95%+ of matching logic

#### RulesEngine (`rules-engine.test.ts`)
- ✅ UNDERCUT strategy
- ✅ MATCH strategy
- ✅ PERCENTAGE strategy
- ✅ MARGIN_LOCK strategy
- ✅ THRESHOLD strategy
- ✅ Price change execution
- ✅ Error handling

**Coverage**: 90%+ of rules engine logic

### Integration Tests

#### Integrations API (`integrations.test.ts`)
- ✅ GET: List all integrations
- ✅ POST: Create new integration
- ✅ DELETE: Remove integration
- ✅ Authentication checks
- ✅ Validation (missing fields, invalid URLs)
- ✅ Tenant isolation

**Coverage**: 100% of API endpoints

### Load Tests

#### ScraperService (`scraper.test.ts`)
- ✅ Single page scraping performance (< 30s)
- ✅ Concurrent scraping (5 pages < 60s)
- ✅ Batch scraping with rate limiting
- ✅ Error handling (invalid URLs, timeouts, 404s)
- ✅ Memory leak detection

**Performance Benchmarks**:
- Single page: < 30 seconds
- 5 concurrent pages: < 60 seconds
- 10 batch pages: ~10-20 seconds (with rate limiting)
- Memory increase: < 100MB for 20 scrapes

## Writing New Tests

### Unit Test Template
```typescript
import { YourService } from '@/lib/services/your-service';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    // Mock Prisma methods
  },
}));

describe('YourService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', async () => {
    // Arrange
    const input = 'test';

    // Act
    const result = await YourService.doSomething(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Integration Test Template
```typescript
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/your-endpoint/route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

describe('/api/your-endpoint', () => {
  it('should return data', async () => {
    const req = new NextRequest('http://localhost:3000/api/your-endpoint');
    const response = await GET(req);

    expect(response.status).toBe(200);
  });
});
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies (Prisma, APIs)
3. **Coverage**: Aim for 80%+ code coverage
4. **Performance**: Keep unit tests fast (< 1s each)
5. **Descriptive**: Use clear test names that describe behavior
6. **Arrange-Act-Assert**: Follow AAA pattern

## Troubleshooting

### Tests Failing Locally
```bash
# Clear Jest cache
npx jest --clearCache

# Run with verbose output
npm test -- --verbose
```

### Timeout Issues
Increase timeout for specific tests:
```typescript
it('should handle long operation', async () => {
  // test code
}, 30000); // 30 second timeout
```

### Mock Issues
Ensure mocks are cleared between tests:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Next Steps

- [ ] Add E2E tests with Playwright Test
- [ ] Set up continuous integration
- [ ] Add visual regression testing
- [ ] Implement mutation testing
- [ ] Add API contract testing
