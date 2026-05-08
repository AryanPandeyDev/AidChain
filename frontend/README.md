# AidChain Frontend

React/Vite web app for AidChain donors, NGOs, admins, and the public landing page.

## Stack

| Area | Tooling |
|---|---|
| App framework | React 19 + Vite 8 |
| Styling | Tailwind CSS |
| Server state | TanStack React Query |
| Auth | Clerk React SDK |
| Routing | Manual hash routing in `src/App.jsx` |
| API base | `VITE_API_BASE_URL` |

## Environment

Create `frontend/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE_URL=http://localhost:8080
VITE_CHAIN_ID=11155111
VITE_USDC_ADDRESS=0x0E1D4339cb52257d09D6B6F114683009eF4f60e3
```

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Current Integration Status

- Pool browsing reads `GET /api/pools`.
- Donor dashboard reads pools and `GET /api/donations/my`.
- Public pool detail donates through MetaMask with USDC `approve()` followed by `CrisisPool.donate()`.
- NGO wallet connection requests MetaMask accounts, signs the AidChain wallet verification message, and saves the verified wallet through `POST /api/auth/connect-wallet`.
- NGO application submits JSON to `POST /api/ngo/apply`, but file uploads are still placeholder URLs.
- NGO proof submission sends a receipt URL and manual OCR fields to `POST /api/proofs`; real upload/OCR extraction is not wired yet.
- Admin pages call backend APIs for NGO review, pool creation, assignments, and pause/resume.
- Several sidebar/hash routes are linked but not implemented yet. See `../FRONTEND_BACKEND_GAP_ANALYSIS.md`.
