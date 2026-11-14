# FinanceOS

FinanceOS v51 is a browser-first personal finance command center.

## Deployment

- Vercel serves \`index.html\` from the repository root.
- The app is a static web app. No framework build step is required.
- \`npm test\` runs the financial regression tests with Node.js.
- GitHub Actions runs the same test command on feature-branch pushes and pull requests to \`main\`.

## Data storage and recovery

- FinanceOS stores financial records in IndexedDB and mirrors the main state to localStorage.
- New vault keys are persisted in localStorage so a normal new tab or browser session can read the same data.
- The existing VAULT format is legacy XOR obfuscation. It is **not cryptographic encryption** and must not be treated as protection against someone who can inspect or execute code in the browser.
- If an older installation has lost the temporary session key, FinanceOS cannot mathematically reconstruct that key. The app now preserves the unreadable record instead of deleting it, and it asks the user to import a valid JSON backup.
- Export backups regularly and keep a copy outside the browser. Browser storage can still be cleared by the user, browser policies, or device failure.
- Imports validate the expected arrays and important record fields before replacing the active state.
- Deleting local FinanceOS data deletes this browser's FinanceOS records and local profile. It does not cancel remote services because no cloud account service is included.

## Financial calculation rules

- Dashboard and business net worth use assets plus unmatched investment records minus outstanding debt.
- Savings and investment categories are treated as transfers, not spending, in the dashboard and Analytics.
- Freedom Path checks monthly subscription/debt entries before subtracting additional obligations to reduce double counting.
- Business runway uses liquid cash divided by monthly expenses. Available startup capital excludes the required emergency reserve. Debt-to-income uses monthly debt payments divided by monthly income.
- Monthly expense fallback values are returned with an explicit estimate status. They are not presented internally as verified current-month transaction totals.
- Recurring schedules use calendar arithmetic, preserve days 29–31 where possible, and catch up overdue cycles without duplicating an already-generated recurring transaction.

## AI and account services

- AI features are currently disabled. The earlier browser code attempted direct Anthropic calls without a protected server route. FinanceOS now blocks those requests rather than sending financial data from a public page.
- Google and Facebook OAuth, email password recovery, PIN reset email, cloud sync, and remote device revocation are not connected.
- The local device profile is not a cloud account. Its password does not recover data on another device.
- To enable AI, email recovery, OAuth, or remote sessions, add a protected backend, server-side secrets, verified identity flows, authorization checks, and tests before exposing those actions.

## Progressive Web App

- The app registers the repository's single same-origin \`sw.js\` service worker.
- The worker cache version is kept in one file and includes the financial core module used by the page.
