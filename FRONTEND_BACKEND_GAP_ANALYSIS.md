# AidChain Frontend/Backend Gap Analysis

Date: 2026-05-08

This document is a handoff for the backend agent. It audits the current React frontend for mock data, placeholder flows, and incomplete frontend/backend integration. The biggest issue is not that every endpoint is missing; many endpoints already exist in the Go backend. The remaining work is to remove silent fallbacks, add upload/OCR/donation support, fix auth provisioning reliability, and align response contracts used by the UI.

## Executive Summary

The frontend is partly wired to the backend through `frontend/src/api/*`, with `VITE_API_BASE_URL=http://localhost:8080`. Existing backend routes cover pools, NGO applications, admin review, assignments, proofs, trust, donations queries, and Clerk auth. However, several user-facing flows still use placeholder data or are not connected to production-grade backend capabilities.

Highest priority gaps:

1. Public pool detail/donation flow is broken or absent. Frontend links to `#/pool/:id`, but `App.jsx` only renders `PoolDetail` for `#/admin/pool-detail/:id`.
2. Donations have read endpoints only. There is no frontend donate transaction flow and no backend API to prepare/record a user-initiated donation outside the blockchain listener.
3. NGO document uploads are fake URLs under `https://dev-placeholder.aidchain.local/...`; there is no backend upload/presign endpoint.
4. Proof submission asks the NGO to type a receipt URL and manually fill OCR fields; no backend upload/OCR extraction endpoint exists.
5. `fetchPools()` and `fetchPool()` silently fall back to hardcoded mock pools when the backend fails, which hides integration errors.
6. NGO dashboard uses `placeholderData: FALLBACK`, so unauthenticated/failed backend states can look like real NGO data.
7. Wallet connection in the NGO application only stores local component state. It does not call `/api/auth/connect-wallet`, and the backend application handler ignores `wallet_address` from the submit payload.
8. Clerk provisioning depends on `/api/dev/provision` and Clerk metadata propagation. This is acceptable for local development but should not be the main production path.

## Current API Surface Used By Frontend

Frontend API files:

- `frontend/src/api/client.js`: central `apiFetch`, attaches Clerk token.
- `frontend/src/api/pools.js`: public pool list/detail, with mock fallback.
- `frontend/src/api/ngo.js`: NGO application, dashboard, proof, trust, assignment, wallet APIs.
- `frontend/src/api/admin.js`: admin NGO review, pool creation, pause/resume, assignment approvals.
- `frontend/src/api/donations.js`: donation query APIs.

Backend routes currently present in `backend/main.go`:

- Public:
  - `GET /api/pools`
  - `GET /api/pools/:id`
  - `POST /api/webhooks/clerk`
  - `POST /api/dev/provision` in development
- Authenticated:
  - `POST /api/auth/connect-wallet`
  - `GET /api/donations/my`
  - `GET /api/donations/pool/:poolId`
  - `POST /api/proofs`
  - `GET /api/proofs/my`
  - `GET /api/proofs/pool/:poolId`
  - `GET /api/proofs/:id`
  - `GET /api/trust/my`
  - `GET /api/trust/ngo/:ngoId`
  - `POST /api/ngo/apply`
  - `GET /api/ngo/application/status`
  - `GET /api/ngo/dashboard`
  - `POST /api/ngo/pools/:poolId/request-assignment`
  - `GET /api/ngo/assignment-requests`
- Admin:
  - `GET /api/admin/ngo/applications`
  - `GET /api/admin/ngo/applications/:id`
  - `POST /api/admin/ngo/applications/:id/approve`
  - `POST /api/admin/ngo/applications/:id/reject`
  - `POST /api/admin/pools`
  - `POST /api/admin/pools/:id/pause`
  - `POST /api/admin/pools/:id/resume`
  - `GET /api/admin/pools/:id/assignment-requests`
  - `POST /api/admin/pools/:id/assignment-requests/:reqId/approve`
  - `POST /api/admin/pools/:id/assignment-requests/:reqId/reject`

## Deep UI Component Audit

This section goes component by component and page by page. It distinguishes between data that is fetched from the backend, static marketing content, visual placeholders, local-only UI state, and UI links/actions that are currently not backed by a route or API.

### App shell and routing

File: `frontend/src/App.jsx`

Fetched data:

- None directly. It only chooses which page component to render.

Static/local behavior:

- Hash routing is manually implemented with `window.location.hash`.
- The app imports `@tanstack/react-query` but does not use a real router even though `@tanstack/react-router` is installed.

Broken or missing route coverage:

- `#/pool/:id` is linked from donor/public pool cards but is not rendered by `App.jsx`.
- `#/donations`, `#/wallet`, `#/settings` are linked by the donor `Sidebar` but not routed.
- `#/ngo/submissions`, `#/ngo/assignments`, `#/ngo/trust`, `#/ngo/overview`, `#/ngo/missions`, `#/ngo/ledger`, `#/ngo/ngo-dashboard` are linked in NGO sidebars but not routed.
- `#/admin/pools`, `#/admin/ledger`, `#/admin/settings` are linked by admin sidebars but not routed.
- `#/sso-callback` is used by Google sign-in redirect but not routed.
- `#forgot` is linked from sign in but not routed.

Backend instruction:

- Backend cannot fix routing, but it should expose the data needed for the missing pages if the frontend keeps those routes: donor donation history/detail, wallet profile, NGO submissions, assignment requests, trust history, admin ledger, and settings/profile.

### AuthProvider

File: `frontend/src/auth/AuthProvider.jsx`

Fetched data:

- Calls Clerk SDK for user/session data.
- Calls `POST /api/dev/provision` when Clerk public metadata lacks `db_user_id` or `role`.

Static/local behavior:

- If `VITE_CLERK_PUBLISHABLE_KEY` is missing, it provides a mock unauthenticated context with role `DONOR`.
- Session token is stored on `window.__clerk_session_token` for API calls.

Backend/API gaps:

- There is no `GET /api/me`, so the UI cannot reliably load DB role/profile directly from the backend.
- `/api/dev/provision` is treated as a normal runtime path by the frontend; backend should restrict this to development.

Backend instruction:

- Add `GET /api/me` and use it as the frontend's source of truth for `role`, `dbUserId`, `wallet_address`, `trust_score`, and `flagged`.
- Keep Clerk webhook provisioning as the production path and make `/api/dev/provision` local-only.

### Navbar

File: `frontend/src/components/Navbar.jsx`

Fetched data:

- Uses `useAuth()` for `isSignedIn`, `user`, and `role`.

Static/local behavior:

- `user` is imported from auth but not actually displayed.
- Links to static landing anchors: `#transparency`, `#impact`, `#methodology`.
- `Donate Now` links to `#/pools`, not a donation flow.

Backend/API gaps:

- Needs reliable role/profile data from `/api/me` so dashboard navigation does not depend only on Clerk metadata timing.

### Donor Sidebar

File: `frontend/src/components/Sidebar.jsx`

Fetched data:

- None.

Static/local behavior:

- Default user is `Alex Rivera`.
- Nav items are static.
- `Support` is `href="#"`.
- `Sign Out` is `href="#/"`; it does not call Clerk sign-out.
- `My Donations`, `Wallet`, and `Settings` point to routes not implemented in `App.jsx`.
- `Connected` status in donor dashboard is separately hardcoded and not tied to wallet/backend state.

Backend instruction:

- Add user/profile endpoint (`GET /api/me`) with wallet connection status.
- If keeping wallet/settings pages, backend should expose wallet details and profile settings endpoints.

### Landing: Hero

File: `frontend/src/components/Hero.jsx`

Priority: Low. This is mostly decorative/marketing UI.

Fetched data:

- None.

Static/local behavior:

- Marketing copy is hardcoded.
- Hero image is a hardcoded remote Googleusercontent image.
- Badge text `100% On-Chain Verified` is hardcoded.
- `Start Donating` links to pool browse, not a real donation action.
- `Become a Partner` links to NGO application.

Backend/API gaps:

- None for MVP. Do not spend backend effort here unless the product explicitly wants live landing metrics or CMS-managed media.

### Landing: WhySection

File: `frontend/src/components/WhySection.jsx`

Priority: Low. This is decorative/marketing content.

Fetched data:

- None.

Static/local behavior:

- All cards are hardcoded marketing copy.

Backend/API gaps:

- None for MVP.

### Landing: HowItWorks

File: `frontend/src/components/HowItWorks.jsx`

Priority: Low. Treat the ledger visual as illustrative unless the team wants a live public ledger preview.

Fetched data:

- None.

Static/local behavior:

- Steps are static.
- Ledger visual is fake data:
  - `0x7a...F92`
  - `MILESTONE_1_VERIFIED`
  - `+5,000 USDC`
  - `0.002 MATIC`
  - `IMPACT_SCORE_UPDATED`
  - `A+ (9.8/10)`
- Image is a hardcoded remote Googleusercontent image.

Backend instruction:

- No backend work needed for MVP if this remains an illustrative section.
- If later made dynamic, add a public ledger summary endpoint.

### Landing: FeaturedPools

File: `frontend/src/components/FeaturedPools.jsx`

Priority: Medium. This is landing UI, but it displays real pool data and links into donor flows.

Fetched data:

- Uses `fetchPools()` through React Query.

Static/local behavior mixed with fetched data:

- Uses fetched `pool.name`, `description`, `percentFunded`, `fundedAmount`, `targetAmount`, and `donationsPaused`.
- Uses hardcoded `DEFAULT_IMAGES` unless backend supplies `pool.image`.
- Uses `pool.tag`, but backend currently does not return `tag`.
- If `pool.tag` is missing, it infers `EMERGENCY` from region containing `sudan`, otherwise uses `ACTIVE`.
- `Donate Now` is a disabled/enabled button only; it does not navigate or start donation.
- Error text says "Showing cached data", but `fetchPools()` may actually be returning hardcoded fallback pools.
- `View All Projects` links to `#projects`, not `#/pools`.

Backend instruction:

- Add `image_url` and `tag/category` to pool responses if this UI remains.
- Provide `percent_funded`, `donated_amount`, and `target_amount` directly.
- Donation action needs a backend-supported wallet flow or transaction preparation endpoint.

### Landing: TrustScoring

File: `frontend/src/components/TrustScoring.jsx`

Priority: Low. This is illustrative/marketing content unless the team wants real public trust highlights.

Fetched data:

- None.

Static/local behavior:

- Entire NGO score card is illustrative:
  - `Global Relief Corp`
  - `Verified Partner since 2022`
  - `9.8 Impact Score`
  - `99.2% Verification Accuracy`
  - `Fast Fund Utilization Speed`
  - Gold Seal copy and badge.

Backend instruction:

- If frontend wants real trust leaderboard/demo data, add public endpoint:
  - `GET /api/public/trust/highlights`
  - Return top verified NGOs, trust score, verification accuracy, proof count, released amount, and badge tier.
- Otherwise no backend work is needed for MVP.

### Landing: CTASection

File: `frontend/src/components/CTASection.jsx`

Priority: Low unless email capture is a product requirement.

Fetched data:

- None.

Static/local behavior:

- Email form only updates local state.
- `Join Us` changes to `Joined!` for 3 seconds, but no request is sent.
- Background image is hardcoded remote Googleusercontent.

Backend instruction:

- If the CTA is intended to collect leads, add:
  - `POST /api/leads`
  - Request: `{ "email": "...", "source": "landing_cta" }`
- If not, no backend work is needed for MVP; frontend can leave it decorative or route it to registration later.

### Footer

File: `frontend/src/components/Footer.jsx`

Priority: Low. Mostly decorative/navigation content.

Fetched data:

- None.

Static/local behavior:

- Many footer links are `href="#"`.
- `Polygon Explorer` is the only real external link.
- Copyright says 2025.
- Network status is hardcoded:
  - `Polygon Mainnet`
  - `Block Height: #62,492,019`

Backend instruction:

- If network status should be real, add:
  - `GET /api/status`
  - Return `chain_id`, `network_name`, `latest_block`, `backend_version`, `event_sync_lag`, and service health.
- Otherwise no backend work is needed for MVP.

### SignIn

File: `frontend/src/pages/SignIn.jsx`

Fetched data:

- Uses Clerk `useSignIn()`.

Static/local behavior:

- On successful sign-in, always routes to `#/dashboard` regardless of role.
- Google SSO uses `#/sso-callback`, which is not routed.
- `Forgot password?` links to `#forgot`, which is not routed.
- Left-panel copy is static.

Backend/API gaps:

- Needs `GET /api/me` after sign-in so frontend can route ADMIN to `#/admin`, NGO to application/status/dashboard depending on status, and DONOR to `#/dashboard`.

### Register

File: `frontend/src/pages/Register.jsx`

Fetched data:

- Uses Clerk `useSignUp()`.

Static/local behavior:

- Role selector writes Clerk `unsafeMetadata.role`.
- Password strength is local-only.
- After verification, DONOR goes to `#/dashboard`, NGO goes to `#/ngo/apply`.
- Terms/privacy links are `href="#"`.

Backend/API gaps:

- Production backend must sync Clerk users through webhook and set public metadata.
- Add `GET /api/me` to verify provisioning and route correctly.

### BrowsePools

File: `frontend/src/pages/BrowsePools.jsx`

Fetched data:

- Uses `fetchPools()`.

Static/local behavior mixed with fetched data:

- Search filters fetched pool `name` and `region`.
- Category filter depends on `pool.tag`, which backend does not return.
- Categories are static: `All`, `Emergency`, `Sustainability`, `Education`, `Health`, `Infrastructure`.
- Card image area is a generic material icon, not real pool media.
- `Donate Now` links to `#/pool/:id`, but that route does not exist.
- If backend is down, `fetchPools()` supplies fake fallback pools.

Backend instruction:

- Add `tag/category` and `image_url` to pool responses, or remove these UI affordances.
- Provide a public pool detail response and donation preparation/recording flow.

### DonorDashboard

File: `frontend/src/pages/DonorDashboard.jsx`

Fetched data:

- Uses `fetchPools()`.
- Uses `fetchMyDonations()`.
- Uses Clerk `user.firstName`.

Static/local behavior mixed with fetched data:

- Displays `Connected` as hardcoded status, not based on wallet/session/backend state.
- Active pool cards use fetched pool data but generic icon imagery.
- `View Details` links to `#/pool/:id`, which is not routed.
- Donations table uses real donation records if backend returns them.
- Donation status is always displayed as `Confirmed`; backend response has no status/confirmation field.
- Tx link always uses `https://polygonscan.com/tx/...`, regardless of configured chain/network.

Backend instruction:

- Add donation status fields:
  - `status`: `PENDING|CONFIRMED|FAILED`
  - `confirmations`
  - `chain_id`
  - `explorer_tx_url`
- Add wallet/profile state to `/api/me`.
- Provide real public pool detail route data.

### NGO Application

File: `frontend/src/pages/NgoApplication.jsx`

Fetched data:

- Submits to `POST /api/ngo/apply`.

Static/local behavior mixed with fetched data:

- Country list is hardcoded.
- Wallet connect only reads MetaMask account into local state.
- It does not sign a nonce or call `POST /api/auth/connect-wallet`.
- File inputs store selected `File` objects locally but do not upload them.
- Submission converts files into fake `https://dev-placeholder.aidchain.local/...` URLs.
- Sidebar links are static and mostly unrouted.
- `New Initiative` is `href="#"`.
- `description` is sent, but backend does not persist it.
- `wallet_address` is sent, but backend ignores it.

Backend instruction:

- Add upload/presign endpoint and wallet nonce/signature flow.
- Persist application description.
- Require saved `users.wallet_address` for approval rather than trusting application body.

### NGO Application Status

File: `frontend/src/pages/NgoApplicationStatus.jsx`

Fetched data:

- Uses `fetchApplicationStatus()` and polls every 10 seconds.

Static/local behavior mixed with fetched data:

- Timeline text is locally generated from status.
- Verified timeline detail hardcodes `Trust Score: 50/100`.
- Heading includes a celebration glyph rendered from source text, not backend data.
- Rejected status displays backend `rejection_reason`.
- `Need help? Contact support` is `href="#"`.
- No AI evidence or screening summary is displayed to the NGO.

Backend instruction:

- Include `trust_score` in status response after verification.
- Optionally include safe AI summary/evidence fields for NGO-facing status.
- Add support/contact route or remove dead link.

### NGO Dashboard

File: `frontend/src/pages/NgoDashboard.jsx`

Fetched data:

- Uses `fetchNgoDashboard()`.

Static/local behavior mixed with fetched data:

- Uses `placeholderData: FALLBACK`, which can show fake dashboard content while loading or if stale.
- Sidebar is hardcoded inside the page rather than using real profile data.
- Displays user/organization area as `My NGO` if signed in, otherwise `Global Relief Corp`.
- Always shows `NGO - Verified` in sidebar.
- Nav links for submissions, assignments, trust are not routed.
- `New Proposal` is `href="#"`.
- Trust score explanation is static.
- Recent submissions table displays `pool_id`, not pool name.

Backend instruction:

- Extend `GET /api/ngo/dashboard` with:
  - `organization_name`
  - `application_status`
  - `wallet_address`
  - `assigned_pools[].name`
  - `recent_proofs[].pool_name`
  - `recent_proofs[].tx_hash`
  - `recent_proofs[].verification_score`
- Keep empty arrays for no data.

### ProofSubmission

File: `frontend/src/pages/ProofSubmission.jsx`

Fetched data:

- Uses `fetchNgoDashboard()` to select assigned pools.
- Submits final proof to `POST /api/proofs`.

Static/local behavior mixed with fetched data:

- Assigned pool list is real if dashboard is real.
- Receipt upload is a URL input, not file upload.
- OCR fields are manually typed despite UI saying AI extracts them.
- GPS uses browser geolocation, not backend.
- Success is a browser `alert()`, then hash redirect.
- Does not show returned verification score, rejection reason, trust score update, or release tx hash.

Backend instruction:

- Add receipt upload and OCR extraction endpoint.
- Return structured proof result fields and have frontend render them:
  - `verification_status`
  - `verification_score`
  - `new_trust_score`
  - `tx_hash`
  - `explorer_tx_url`
  - `message`

### AdminDashboard

File: `frontend/src/pages/AdminDashboard.jsx`

Fetched data:

- Uses `fetchApplications("PENDING_REVIEW")`.
- Uses `fetchApplications("VERIFIED")`.
- Uses `fetchPools()`.

Static/local behavior mixed with fetched data:

- Admin identity is hardcoded as `Admin` / `Platform`.
- Sidebar links for pools, ledger, settings are not routed.
- Stats are derived from fetched apps/pools, but `Total Pool Value` sums `targetAmount`, not real donated or available funds.
- Active pools use fetched data.
- Manage Pools quick action links to `#/pools`, which is donor/public browse, not admin pool management.

Backend instruction:

- Add admin summary endpoint:
  - `GET /api/admin/summary`
  - Return pending applications, active pools, total target, total donated, total released, verified NGO count, flagged NGO count.
- Add `/api/me` for admin profile display.

### Admin NGO Review

File: `frontend/src/pages/AdminNgoReview.jsx`

Fetched data:

- Lists applications through `fetchApplications(status)`.
- Loads detail through `fetchApplication(id)`.
- Approves/rejects through backend mutations.

Static/local behavior mixed with fetched data:

- Sidebar support/sign-out are dead/static.
- AI pre-screening display depends on backend `ai_confidence_score`, `ai_summary`.
- Uploaded document cards link to whatever URLs backend has. Today those may be fake dev-placeholder URLs because NGO application upload is fake.
- Application detail does not display application `description`.
- Does not display wallet address, even though approval on-chain needs the NGO wallet.
- Does not display AI evidence JSON.

Backend instruction:

- Return and persist:
  - `description`
  - `wallet_address` from users table
  - `ai_evidence`
  - document object metadata if available
- Consider rejecting approval with a clear error when wallet is absent; current backend already does this when blockchain is enabled.

### CreatePool

File: `frontend/src/pages/CreatePool.jsx`

Fetched data:

- Submits to `POST /api/admin/pools`.

Static/local behavior mixed with fetched data:

- Default values are prefilled:
  - target amount `1000000`
  - max per claim `5000`
  - max per NGO/day `25000`
  - max per NGO/pool `100000`
- Region coordinates are manually typed.
- Success/failure uses browser `alert()`.
- Copy says Polygon gas applies.
- Sidebar support/sign-out are dead/static.
- If blockchain is not configured, backend requires `contract_address`, but frontend never supplies one.

Backend instruction:

- In local/dev mode, either auto-provision a mock contract address or expose clear blockchain config health before user submits.
- Add geocoding/location helper only if the UI should avoid manual lat/lng entry.
- Return structured deploy result:
  - `pool_id`
  - `contract_address`
  - `tx_hash`
  - `explorer_tx_url`

### Admin PoolDetail

File: `frontend/src/pages/PoolDetail.jsx`

Fetched data:

- Uses `fetchPool(poolId)`.
- Uses `fetchPoolAssignmentRequests(poolId, "PENDING")`.
- Uses `fetchPoolDonations(poolId)` only when Donations tab is active.
- Uses mutations for pause/resume and assignment approve/reject.

Static/local behavior mixed with fetched data:

- This page is admin-only by route convention but is not actually route-protected in frontend.
- Assigned NGOs show only ID, wallet, trust score. No organization name.
- Pending assignment cards use backend request data.
- Donations table always displays abbreviated donor ID, amount, tx hash, date; no status or explorer link.
- Pool settings uses fetched config.
- Pause/resume result does not show tx hash/note from backend.
- Sidebar ledger/settings routes are not implemented.

Backend instruction:

- Extend `GET /api/pools/:id` assigned NGO objects with:
  - `organization_name`
  - `country`
  - `application_id`
  - `assigned_at`
- Extend donation rows with status, explorer URL, and donor display name if allowed.
- Return tx hash/explorer URL from pause/resume/assignment approval mutations.

### Admin/public PoolDetail route conflict

File: `frontend/src/pages/PoolDetail.jsx`

Issue:

- The component parses only `#/admin/pool-detail/:id`.
- Public and donor screens link to `#/pool/:id`, but no matching page exists.

Backend instruction:

- Provide one pool detail contract that can support both admin and public views, with admin-only fields protected by admin endpoints.

## Mock Data And Placeholder Inventory

### 1. Pool fallback mocks

File: `frontend/src/api/pools.js`

Issue:

- `fetchPools()` catches all backend errors and returns `FALLBACK_POOLS`.
- `fetchPool(id)` catches all backend errors and returns a fallback pool.
- Mock fields include fake pool IDs, fake contract addresses, tags, funding progress, and fake balances.

Backend impact:

- Integration failures are hidden from users and developers.
- The frontend can navigate with fake IDs that are not valid UUIDs; backend proof submission requires UUID pool IDs.

Backend instruction:

- Ensure `GET /api/pools` and `GET /api/pools/:id` return all fields the frontend expects so the fallback can be removed:
  - `id`
  - `name`
  - `description`
  - `region`
  - `region_lat`
  - `region_lng`
  - `region_radius_km`
  - `target_amount`
  - `pool_balance`
  - `funded_amount` or enough donation/balance data to derive it
  - `contract_address`
  - `max_per_claim`
  - `max_per_ngo_per_day`
  - `max_per_ngo_pool`
  - `donations_paused`
  - `status`
  - `created_at`
  - optional but useful: `tag`, `image_url`

Current backend mismatch:

- `GET /api/pools` does not return `pool_balance`, `funded_amount`, `region_lat`, `region_lng`, caps, `tag`, or `image_url`.
- `GET /api/pools/:id` can return live `pool_balance`, but only when blockchain is configured. If not, frontend computes `fundedAmount` as `target - 0`, which incorrectly displays 100 percent funded.

Recommended backend changes:

- Add a stable `funded_amount` to list/detail responses, calculated from donations table or chain events.
- Add `pool_balance` for list responses if available.
- Return `pool_balance: null` instead of omitting it when chain is unavailable; frontend can display "sync pending" instead of a false 100 percent.
- Add optional `category/tag` and `image_url` to `crisis_pools` if category filtering and real imagery are needed.

### 2. NGO dashboard placeholder data

File: `frontend/src/pages/NgoDashboard.jsx`

Issue:

- `useQuery` uses `placeholderData: FALLBACK`.
- Fallback includes fake trust score, assigned pools, and proof submissions.
- The sidebar also displays `"Global Relief Corp"` and `"NGO - Verified"` when not signed in.

Backend impact:

- Backend failures can appear as real NGO status.
- A not-yet-verified NGO may see dashboard-looking placeholder data.

Backend instruction:

- Keep `GET /api/ngo/dashboard` strict. It already returns `403` when NGO is not verified.
- Return complete empty arrays for valid verified NGOs with no data:
  - `assigned_pools: []`
  - `recent_proofs: []`
- Include enough NGO profile fields to replace sidebar placeholders:
  - `organization_name`
  - `wallet_address`
  - `application_status`
  - `trust_score`
  - `flagged`

Frontend follow-up:

- Remove `placeholderData: FALLBACK`.
- Render real loading/error/empty states instead.

### 3. NGO application document upload placeholders

File: `frontend/src/pages/NgoApplication.jsx`

Issue:

- File inputs do not upload files.
- `handleSubmit()` sends fake URLs like:
  - `https://dev-placeholder.aidchain.local/reg-cert.pdf`
  - `https://dev-placeholder.aidchain.local/tax-id.pdf`
  - `https://dev-placeholder.aidchain.local/proof-ops.pdf`
- `wallet_address` is sent in the request body, but backend `applyBody` does not include it.
- Wallet connection only calls MetaMask `eth_requestAccounts`; it does not prove ownership or save the wallet to the backend.

Current backend mismatch:

- `POST /api/ngo/apply` requires document URL strings, but there is no upload endpoint.
- `POST /api/auth/connect-wallet` requires `wallet_address`, `signature`, and `nonce`, but frontend never calls it.
- `POST /api/ngo/apply` does not save `description`; the migration does not include a `description` column even though frontend sends one.

Backend instruction:

- Add upload support before the application submit step. Recommended endpoints:
  - `POST /api/uploads/presign`
  - Request: `{ "purpose": "ngo_application_doc", "filename": "...", "content_type": "application/pdf" }`
  - Response: `{ "upload_url": "...", "public_url": "...", "object_key": "...", "expires_in": 900 }`
- Store uploaded document object keys and/or public URLs on `ngo_applications`.
- Either add `description TEXT` to `ngo_applications` or remove it from the frontend contract.
- Add nonce endpoint for wallet ownership:
  - `GET /api/auth/wallet-nonce`
  - Response: `{ "nonce": "...", "message": "AidChain Wallet Verification\nNonce: ..." }`
- Frontend should sign the exact message and call `POST /api/auth/connect-wallet`.
- Backend should require a connected wallet before approving an NGO on-chain.

### 4. Proof submission receipt URL and manual OCR placeholders

File: `frontend/src/pages/ProofSubmission.jsx`

Issue:

- The UI says "Upload Receipt" but only accepts a URL text box.
- It says "AI OCR will extract data automatically", but the user manually enters OCR amount/vendor/date.
- There is no upload endpoint or OCR extraction endpoint.

Current backend behavior:

- `POST /api/proofs` accepts:
  - `pool_id`
  - `receipt_image_url`
  - `claimed_amount`
  - `ocr_amount`
  - `ocr_vendor`
  - `ocr_date`
  - `latitude`
  - `longitude`
- Backend then does deterministic verification, not OCR.

Backend instruction:

- Add receipt upload support, ideally reusing the upload presign endpoint:
  - purpose: `proof_receipt`
- Add OCR extraction endpoint:
  - `POST /api/proofs/ocr`
  - Request: `{ "receipt_image_url": "https://..." }`
  - Response: `{ "ocr_amount": 2500, "ocr_vendor": "Medical Supplies Inc.", "ocr_date": "2026-05-08", "confidence": 0.92, "raw_text": "..." }`
- Keep `POST /api/proofs` as the final submit endpoint, but backend should treat OCR fields as server-generated or verified fields where possible.
- Consider storing OCR confidence and raw text in `proof_submissions` for auditability.

### 5. Public pool detail and donation flow missing

Files:

- `frontend/src/App.jsx`
- `frontend/src/pages/BrowsePools.jsx`
- `frontend/src/components/FeaturedPools.jsx`
- `frontend/src/pages/DonorDashboard.jsx`

Issue:

- Pool cards link to `#/pool/${pool.id}`, but `App.jsx` has no route for `#/pool/:id`.
- The only pool detail page currently rendered is the admin detail route `#/admin/pool-detail/:id`.
- Featured pool "Donate Now" buttons are not linked to any donation flow.
- Backend has donation query endpoints, but no donation creation/preparation endpoint.

Backend instruction:

- Decide the donation architecture:
  - Option A: frontend performs USDC approval/donate directly against smart contracts, backend only listens for events.
  - Option B: backend prepares unsigned transaction payloads, frontend wallet signs/sends.
- For Option B, add:
  - `POST /api/pools/:id/donate/prepare`
  - Request: `{ "amount": 100 }`
  - Response: `{ "to": "0xPoolContract", "data": "0x...", "value": "0x0", "chain_id": 137, "usdc_address": "0x..." }`
- Add/read event sync status so the UI can show "pending confirmation" after wallet send.
- Donation records should still be inserted idempotently from chain events with `tx_hash` unique.

Frontend follow-up:

- Add a donor/public pool detail page for `#/pool/:id`.
- Add a real donate button flow.
- Show pool proofs/donations on public detail using:
  - `GET /api/donations/pool/:poolId`
  - `GET /api/proofs/pool/:poolId`

### 6. Assignment request flow is only partially exposed

Files:

- `frontend/src/api/ngo.js`
- `frontend/src/pages/NgoDashboard.jsx`
- `frontend/src/pages/BrowsePools.jsx`

Issue:

- API functions exist:
  - `requestPoolAssignment(poolId, body)`
  - `fetchMyAssignmentRequests()`
- But no complete frontend screen currently lets an NGO request assignment from a pool.
- NGO sidebar has links to `#/ngo/assignments`, `#/ngo/submissions`, `#/ngo/trust`, but `App.jsx` does not route them.

Backend status:

- Backend assignment endpoints are implemented.

Backend instruction:

- Response contracts are mostly sufficient. Ensure assignment request responses include:
  - `id`
  - `pool_id`
  - `pool_name`
  - `ngo_user_id`
  - `ngo_name`
  - `trust_score`
  - `justification`
  - `supporting_doc_url`
  - `status`
  - `rejection_reason`
  - `created_at`
  - `reviewed_at`
- Add upload support for `supporting_doc_url` if supporting documents are required.

Frontend follow-up:

- Add NGO assignment request modal/page from pool detail or browse pool.
- Add `#/ngo/assignments` route.

### 7. Admin navigation placeholders

Files:

- `frontend/src/pages/AdminDashboard.jsx`
- `frontend/src/pages/AdminNgoReview.jsx`
- `frontend/src/pages/CreatePool.jsx`
- `frontend/src/pages/PoolDetail.jsx`

Issue:

- Sidebar links for Impact Ledger, Settings, Support are placeholders.
- Admin pool management exists only through dashboard and pool detail; there is no dedicated route for `#/admin/pools`, `#/admin/ledger`, or `#/admin/settings`.

Backend instruction:

- For Impact Ledger, backend should expose an aggregate audit feed:
  - `GET /api/admin/ledger`
  - Include pool creation, donations, proof submissions, fund releases, assignment approvals, pause/resume events.
- For settings, expose only if needed later. Not required for MVP unless frontend keeps the link.

### 8. Auth and role routing gaps

Files:

- `frontend/src/auth/AuthProvider.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/pages/SignIn.jsx`
- `backend/middleware/middleware.go`
- `backend/handlers/auth.go`

Issue:

- Frontend relies on Clerk for sign up/sign in.
- `AuthProvider` auto-calls `/api/dev/provision` if Clerk metadata is missing.
- `/api/dev/provision` is unauthenticated in backend development mode and fetches Clerk user by ID.
- Sign-in redirects all users to `#/dashboard` regardless of role.
- Frontend role is taken from Clerk public metadata. If metadata propagation lags, role routing and protected backend calls fail.

Backend instruction:

- Production path should be Clerk webhook first:
  - `POST /api/webhooks/clerk` creates/updates local users.
  - Clerk public metadata gets `db_user_id` and `role`.
- Keep `/api/dev/provision` only for development, guarded by an environment flag and/or internal secret.
- Add a simple authenticated user endpoint:
  - `GET /api/me`
  - Response: `{ "id": "...", "email": "...", "name": "...", "role": "DONOR|NGO|ADMIN", "wallet_address": "...", "trust_score": 50, "flagged": false }`
- Frontend can use `/api/me` to route users after login and avoid relying only on Clerk metadata timing.

### 9. AI screening service environment mismatch

Files:

- `backend/handlers/ngo.go`
- `backend/.env.example`
- `ai-screening-service/README.md`

Issue:

- Go backend uses `AI_SCREENING_URL`.
- Docs and examples have now been standardized to `AI_SCREENING_URL=http://localhost:8090`.
- Ensure any local `.env` files also use the same variable and port.

Backend instruction:

- Keep `AI_SCREENING_URL` as the single env var.
- Keep default port `8090` between backend docs and AI README.
- If the AI service requires `X-Internal-Secret`, add that header in `screenNGOApplication()`. Current code does not send it.

### 10. Data shape issues to fix or confirm

Pool response:

- Frontend currently maps `fundedAmount` from `target_amount - pool_balance`.
- If `pool_balance` means remaining balance, this is okay only after donations are synced.
- If `pool_balance` means available funds in the pool contract, it will equal donated minus released, not target remaining. Then `target - balance` is wrong.

Backend instruction:

- Define these fields explicitly:
  - `target_amount`: goal/campaign target.
  - `donated_amount`: total donated into pool.
  - `released_amount`: total released to NGOs.
  - `pool_balance`: current on-chain USDC balance.
  - `percent_funded`: `donated_amount / target_amount * 100`.
- Return `percent_funded` directly to avoid frontend inference errors.

NGO application:

- Frontend sends `description`, but backend does not persist it.
- Frontend sends `wallet_address`, but backend does not persist it in `Apply`.
- Backend approval requires wallet stored on `users.wallet_address`.

Backend instruction:

- Persist `description`.
- Do not trust `wallet_address` on application submit. Use `POST /api/auth/connect-wallet` with signature verification.

Donations:

- Frontend expects `amount` as a number in USDC human units.
- Backend returns DB numeric scanned into `float64`, which is acceptable for MVP display but not ideal for money.

Backend instruction:

- For exactness, return money fields as decimal strings or integer USDC base units plus display strings.
- Apply this consistently to pools, donations, caps, and proofs.

## Recommended Backend Priority Plan

### P0: Make failures visible and make core data real

1. Update pool list/detail responses with real `donated_amount`, `released_amount`, `pool_balance`, and `percent_funded`.
2. Add `/api/me` for reliable role/profile loading.
3. Guard or disable `/api/dev/provision` outside local development.
4. Standardize AI screening env vars and internal secret handling.

### P1: Complete upload and verification inputs

1. Add `POST /api/uploads/presign`.
2. Store real NGO document URLs/object keys.
3. Add receipt upload support.
4. Add `POST /api/proofs/ocr` and persist OCR metadata.

### P2: Complete wallet and donation path

1. Add wallet nonce/message endpoint and wire it to `POST /api/auth/connect-wallet`.
2. Add donation transaction preparation endpoint or document direct-contract frontend flow.
3. Add public pool detail data endpoints or enhance `GET /api/pools/:id` to include donations/proofs summaries.

### P3: Admin/NGO operational pages

1. Add admin ledger endpoint.
2. Ensure assignment request response shapes are complete.
3. Add profile/application fields needed by sidebars and dashboards.

## Frontend Changes The Backend Agent Should Expect

Once backend supports the above, the frontend should be updated to:

- Remove `FALLBACK_POOLS` in `frontend/src/api/pools.js`.
- Remove `FALLBACK` placeholder data in `frontend/src/pages/NgoDashboard.jsx`.
- Add public `#/pool/:id` route and donor-facing pool detail/donation page.
- Replace NGO application fake file URLs with real upload calls.
- Replace proof receipt URL text field with upload + OCR flow.
- Call wallet nonce/signature flow before application submission.
- Add routes for `#/ngo/assignments`, `#/ngo/submissions`, `#/ngo/trust`, and admin ledger/settings or remove dead nav links.

## Acceptance Criteria

The project should be considered connected end-to-end when:

1. Turning off the backend does not show fake pools or fake NGO dashboard records.
2. A new Clerk user is provisioned in the DB and can call authenticated APIs without manually editing Clerk metadata.
3. An NGO can connect a wallet, upload real documents, submit an application, pass AI screening, and be approved by admin.
4. An admin approval updates both DB and chain, or returns a clear chain error without partial state.
5. An NGO can request assignment to a pool and admin approval creates both chain and DB assignment.
6. An NGO can upload a receipt, OCR is extracted server-side, GPS and caps are verified, proof is stored, and release funds is attempted.
7. A donor can open a real pool detail page, donate through a wallet flow, and see their donation after event sync.
8. Pool funding progress is derived from real donation/chain data, not target minus missing balance.
