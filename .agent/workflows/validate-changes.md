---
description: Validate changes to ensure no breaking features
---

To ensure that new features or bug fixes don't break existing logic, follow these steps:

1. **Type Check**: Run TypeScript compiler to catch any type-related regressions.
   // turbo
   `npx tsc --noEmit`

2. **Lint Check**: Run ESLint to ensure code matches project standards.
   // turbo
   `npm run lint`

3. **Unit Tests**: Run relevant unit tests to verify core logic.
   // turbo
   `npm run test:unit`

4. **Integration/E2E Tests**: (If applicable) Run Playwright or integration tests for UI critical paths.
   // turbo
   `npx playwright test`

5. **Manual Verification**: Briefly visit the affected pages in the dashboard to ensure they load and function as expected.
