# Library Management Web Application — Experiments 4–9

A React + Vite library application backed by Redux Toolkit and a local Express REST API. The project demonstrates API-based book discovery, global state management, book/borrowing CRUD, and token authentication.

## Included procedures

- **Experiment 5 — REST API and async data:** Open Library search, category/author filters, dynamic work details, DummyJSON sample-member data, API recommendations, loading/error states, and local fallback data. Open Library search/details run through a same-origin Express proxy so the browser does not call `https://openlibrary.org` directly.
- **Experiment 6 — Redux Toolkit:** shared book and borrowing state, action middleware, browser storage persistence, cross-tab state sync, and loading/empty states.
- **Experiment 7 — CRUD:** GET, POST, PUT, PATCH, and DELETE for book records; create, read, renew, return/update, and delete borrowing records through Express endpoints.
- **Experiment 8 — Authentication:** API registration/login, server-hashed passwords, expiring bearer tokens, protected borrowing/history/profile endpoints, logout/token revocation, and invalid/expired-token handling.
- **Experiment 9 — Component testing:** Jest + React Testing Library tests for book cards/lists, member profile loading and errors, book search and category filters, borrow/return/renew interactions, availability labels, and loading/empty/error states.

E-commerce features such as a shopping cart, cart quantity controls, discounts, delivery charge, and checkout pricing are intentionally excluded. The library flow is per-book borrow/hold confirmation. Activity logging is console-only; there is no Activity Log page or `/api/activity` endpoint.

## Requirements and startup

- Node.js 18 or newer (Node 20+ recommended)
- Internet access for Open Library and DummyJSON sample data

Extract the ZIP, open the project folder, and run:

```bash
npm install
npm run dev
```

The command starts Vite (normally `http://localhost:5173`) and the Express REST API (`http://localhost:4000`). The Vite dev server proxies `/api` requests to Express. The API returns `Access-Control-Allow-Methods: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS`, handles preflight `OPTIONS` requests, and allows `http://localhost:5173` and `http://127.0.0.1:5173` by default. Set `CORS_ALLOWED_ORIGINS` to a comma-separated list to permit additional frontend origins.

The Open Library integration now calls `/api/open-library/search.json` and `/api/open-library/works/:id.json`. Express fetches Open Library server-side, avoiding browser-side cross-origin requests. Cover thumbnails still load from `covers.openlibrary.org` as ordinary image resources. These CORS headers apply to this project's API response; they cannot be added to responses sent by the external Open Library service itself.

Register a new member through **Register**, then sign in through **Login**. Accounts stored only in earlier browser-local versions must register once with the server-backed API. The demo database is `server/db.json`; the project also includes `server/db.example.json` as a seed database.

## Inspect activity using browser Developer Tools

Open the app, then press **F12** (or right-click → **Inspect**) and select **Console**. The app prints short messages such as:

```text
[Library] REST API loaded books (10) (GET /api/books -> 200 OK)
[Library] Book added: The Hobbit (POST /api/books -> 201 Created)
[Library] Book updated: The Hobbit (PATCH /api/books/105 -> 200 OK)
[Library] Book checked out: The Hobbit (POST /api/borrowings -> 201 Created)
[Library] Book returned: The Hobbit (PATCH /api/borrowings/<record-id> -> 200 OK)
[Library] Member login successful (POST /api/auth/login -> 200 OK)
[Library] Member logout successful (POST /api/auth/logout -> 200 OK)
```

Exact messages depend on the API result and selected title. Warnings/errors are logged using `console.warn`. Passwords, bearer tokens, authorization headers, and full form payloads are never printed. The Express server also logs concise request results in the terminal with a `[Library API]` prefix.

Select **Network** in Developer Tools to inspect request methods, URLs, and HTTP status codes. Filter by `api` to see calls such as `GET /api/books`, `POST /api/books`, `PUT`/`PATCH /api/books/:id`, and `DELETE /api/books/:id`.

## Book CRUD endpoints

Book reads are public. Book mutations require a valid bearer token.

| Action | Endpoint | Expected result |
|---|---|---|
| List books | `GET /api/books` | `200 OK`, JSON array |
| Read one book | `GET /api/books/:id` | `200 OK` or `404 Not Found` |
| Create a book | `POST /api/books` | `201 Created` |
| Replace a book | `PUT /api/books/:id` | `200 OK` |
| Partially update a book | `PATCH /api/books/:id` | `200 OK` |
| Delete a book | `DELETE /api/books/:id` | `204 No Content`; active loans block deletion with `409 Conflict` |

Open **Manage Books** after signing in to test GET, POST, PUT, PATCH (availability toggle), and DELETE. The delete action asks for confirmation. Book mutations are persisted to `server/db.json`.

## Borrowing CRUD endpoints

All borrowing requests require a bearer token and operate only on the signed-in member's records.

| Action | Endpoint | Expected result |
|---|---|---|
| List own loans | `GET /api/borrowings` | `200 OK`, JSON array |
| Read one own loan | `GET /api/borrowings/:id` | `200 OK` or `404 Not Found` |
| Check out a book | `POST /api/borrowings` | `201 Created`; repeated POST for the same active loan reuses it (`200 OK`) |
| Replace mutable loan fields | `PUT /api/borrowings/:id` | `200 OK`, requires `status` and `dueDate` |
| Renew or return | `PATCH /api/borrowings/:id` | `200 OK` |
| Delete own loan record | `DELETE /api/borrowings/:id` | `204 No Content` |
| Reading history | `GET /api/history` | `200 OK`, only that member's returned loans |
| List/place holds | `GET /api/holds`, `POST /api/holds` | duplicate hold requests are idempotent and do not create duplicate records |

Open **Manage Loans** to exercise borrowing-record POST, GET, PATCH renew/return, and DELETE. A deleted active loan releases the catalogue book. Returning a loan keeps it in reading history; deleting a loan record removes that record from the server list/history.

## Authentication endpoints

- `POST /api/auth/register` — registers a member; server hashes the password using Node `scrypt`.
- `POST /api/auth/login` — validates credentials and issues an opaque bearer token.
- `GET /api/auth/me` — validates a saved token.
- `POST /api/auth/logout` — revokes the token.
- `GET /api/profile`, `PATCH /api/profile` — reads/updates the authenticated member profile.

The browser stores the token as `libraryAuthToken`; the Axios client automatically attaches it to API requests. Tokens expire after 30 minutes by default, and server restart revokes in-memory sessions. A `401` response clears the saved browser session and requires sign-in again. Use HTTPS, rate limiting, and persistent session storage before deploying beyond this classroom demo.

To test a short expiry (minimum one minute), set `AUTH_TOKEN_TTL_MS=60000` before starting the server. In Windows PowerShell:

```powershell
$env:AUTH_TOKEN_TTL_MS="60000"
npm run server
```

## Experiment 9 — component testing (Jest + React Testing Library)

### Test coverage

- `tests/components/BookCard.test.jsx` — book details, availability, borrow/hold label, and navigation.
- `tests/components/BookList.test.jsx` — lists, empty results, borrowed status, and held status.
- `tests/components/Profile.test.jsx` — protected profile loading, API error display, and profile updates.
- `tests/components/SearchAndFilter.test.jsx` — search input, category/author controls, case-insensitive search, and combined category filtering.
- `tests/components/BorrowingComponents.test.jsx` — confirm borrowing, show checkout errors, return a loan, submit renewals, and empty borrowed-books state.
- `tests/components/AvailabilityAndStates.test.jsx` — availability/borrowed/held labels, loading indicators, recommendation errors, and empty recommendations.

The Jest config uses Babel to transform JSX for tests, and `tests/setupTests.js` enables the React Testing Library DOM matchers. App code uses the same pure `filterBooks` helper that the unit tests exercise.

### Step-by-step: install, run, and test

1. Install Node.js 20 or newer (Node.js 18+ also works), then extract the ZIP and open the extracted project folder in VS Code.
2. Open the terminal in that exact folder, where `package.json` is located.
3. Install the app and test dependencies:

   ```bash
   npm install
   ```

4. Run only Experiment 9 component tests:

   ```bash
   npm run test:components
   ```

   Jest should report test suites and individual tests as `PASS`. For watch mode while editing tests, run `npm run test:watch`.

5. Run the Experiment 5–8 API/CRUD/auth smoke tests separately:

   ```bash
   npm run test:api
   ```

   This starts an isolated Express API with a temporary JSON database. It checks authentication enforcement; book GET/POST/PUT/PATCH/DELETE; borrowing GET/POST/PUT/PATCH/DELETE; return/history behavior; duplicate hold handling; CORS preflight; and revoked-token rejection. It does not overwrite `server/db.json`.

6. Run both test groups together:

   ```bash
   npm test
   ```

7. Start the site and API:

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173`, register/sign in, then try search/category filtering, book details, borrow/hold, return/renew, profile, and the management pages. Open Developer Tools with **F12**. Use **Console** to read concise library activity messages and **Network → Fetch/XHR** to inspect REST methods and status codes.

8. Run a production compile check:

   ```bash
   npm run build
   ```

`npm test` runs both component and API tests; if either group fails, fix that failure before considering the experiment verified. The API smoke test requires the project's installed Express dependency. If a port is already in use during `npm run dev`, stop old Vite/Express processes with `Ctrl+C` before restarting.

## Troubleshooting

- A cancelled recommendation request in development was caused by React StrictMode aborting an effect cleanup. The recommendation thunk now deduplicates an in-flight request for the same category and caches successful results for five minutes.

- If `npm run dev` reports that a port is in use, stop the old Vite/Express process with `Ctrl+C` and restart. Only one API server should be writing to the database at a time.
- If a request unexpectedly returns old behavior, stop old processes and start the app from this extracted folder, then hard-refresh the browser.
- A hold POST can return a successful typed result explaining that a title is already borrowed or is currently available. This prevents duplicate holds and checkout races; it is not an API crash.
- An exception whose stack begins with `VM...` and mentions `reportAllChanges` is not a project source path. Test with browser extensions disabled if it persists.

## Project scope

The source keeps the required library application, API, authentication, Redux state, book and borrowing management, search/details/recommendations, and console logging. It removes unrelated cart/checkout pricing features and the in-app activity history screen so developer-console logging is the only activity log surface.
