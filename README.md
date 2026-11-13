# FinanceOS

FinanceOS v50 is a browser-first personal finance command center.

## Vercel deployment

- Vercel serves `index.html` from the repository root.
- The app is a static web app; no build command or Node package install is required.
- Pushes to `main` trigger Vercel deployments after the repository is linked.

## Data and privacy

- Transactions, budgets, settings, and other app data are stored in this browser using IndexedDB with a localStorage fallback.
- This repository does not currently include user accounts, cloud database sync, or cross-device sync.
- Export backups regularly. Clearing browser storage or using another device will not automatically restore the data.

## AI features

AI features are marked as not connected in this hosted build. The original file attempted direct browser requests to Anthropic while claiming that AI was built in. A public client must not contain a provider secret. Add a protected server-side AI integration with authentication and usage limits before enabling those features.

## PWA

The app uses a same-origin web manifest and service worker so installation and app-shell caching work on the Vercel domain.
