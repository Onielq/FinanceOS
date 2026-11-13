# FinanceOS

FinanceOS is a browser-first personal finance application. The main branch is the production version. Work in test/financeos-audit-fixes is a review-only preview until explicitly approved.

## Deployment

- Vercel serves index.html from the repository root.
- Static assets are served from the same origin.
- /api/ai is a deliberate 503 response in this build. It does not call an AI provider.
- Pushes to main create production deployments. Other branches create Preview deployments.

## Data and privacy

- Financial records are stored locally in the user's browser. This build does not provide cloud sync or cross-device recovery.
- Export JSON backups regularly and keep a copy outside the browser.
- Browser storage is not a substitute for an independent backup.
- Local password protection is a device-level lock, not a cloud account.
- Google/Facebook sign-in, email password recovery, remote device revocation, and cloud account deletion are not connected. The UI must not claim those actions succeeded.
- The storage layer uses authenticated AES-GCM encoding with a device-local key. The key remains accessible to same-origin JavaScript; this protects stored records from casual inspection, not from a compromised browser or malicious same-origin script.

## AI features

AI is disabled in this build. The old client attempted direct browser requests to Anthropic and could not authenticate securely. Provider API keys must never be placed in public HTML or browser storage. Before enabling AI, configure a real identity/session system, server-side provider credentials, rate limiting, request validation, and usage controls. The /api/ai route currently returns 503 AI_BACKEND_NOT_CONFIGURED by design.

## Tests

Run the financial-core regression suite with Node.js 24 or later:

```bash
node --test tests/*.test.cjs
```

GitHub Actions runs the same suite for pushes to the test branch and for pull requests to main.

## PWA

The application cache version and the standalone sw.js version are kept aligned. The test branch uses a separate cache version from production.
