# E2E tests (Playwright)

Run from the `CollabBoard/` directory.

## Commands

- **Run all e2e tests (headless):** `npm run test:e2e`
- **Run with browser visible:** `npm run test:e2e:headed`
- **Run with Playwright UI:** `npm run test:e2e:ui`
- **Run one file:** `npx playwright test tests/auth.spec.ts`
- **Run one browser:** `npx playwright test --project=chromium`

If the dev server is already running (`npm run dev`), Playwright will reuse it. Otherwise it starts it automatically (unless in CI).

## Auth in tests

Protected routes (`/board/:boardId`, `/dashboard`) redirect to `/` when not logged in. To test board features (style bar, sticky notes, sync):

1. Use test credentials (e.g. `test@example.com` / `password123`) if you have a test Firebase user.
2. In a test: go to `/`, fill login form, submit, then navigate to `/board/:boardId` or create a board from the dashboard.

## Adding tests

- **Multi-browser collaboration:** create two contexts with `browser.newContext()`, run actions on both, assert sync.
- **Network throttling:** use `page.route()` or `context.route()` to add latency (e.g. 3G).
- **Selectors:** prefer `getByRole`, `getByLabel`, `getByTestId`; add `data-testid` in components if needed.

See the project Testing Guide for Cursor-assisted test generation and more examples.
