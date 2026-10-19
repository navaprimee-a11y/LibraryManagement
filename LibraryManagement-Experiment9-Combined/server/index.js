import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.LIBRARY_DB_PATH ? path.resolve(process.env.LIBRARY_DB_PATH) : path.join(__dirname, 'db.json');
const exampleDbPath = path.join(__dirname, 'db.example.json');
const app = express();
const PORT = Number(process.env.API_PORT || 4000);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) throw new Error('API_PORT must be a valid TCP port number.');
const TOKEN_TTL_MS = Math.max(60_000, Number(process.env.AUTH_TOKEN_TTL_MS) || 30 * 60 * 1000);
const sessions = new Map();

// CORS headers for the local REST API. In development the Vite proxy makes
// /api calls same-origin, but these headers also support direct API access.
// Configure additional origins with CORS_ALLOWED_ORIGINS when needed.
const defaultAllowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = new Set(
  String(process.env.CORS_ALLOWED_ORIGINS || defaultAllowedOrigins.join(','))
    .split(',').map((value) => value.trim()).filter(Boolean),
);
const allowedMethods = 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS';
app.use((req, res, next) => {
  const origin = req.get('Origin');
  const originAllowed = !origin || allowedOrigins.has(origin);
  if (origin && originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    if (!originAllowed) return res.status(403).json({ message: 'This origin is not allowed by the Library API CORS policy.' });
    const requestedMethod = String(req.get('Access-Control-Request-Method') || '').toUpperCase();
    if (requestedMethod && !allowedMethods.split(', ').includes(requestedMethod)) {
      return res.status(405).json({ message: `CORS method ${requestedMethod} is not allowed.` });
    }
    return res.status(204).end();
  }
  next();
});
app.use(express.json({ limit: '1mb' }));

function readDb() {
  try {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    return {
      books: Array.isArray(data.books) ? data.books : [],
      borrowings: Array.isArray(data.borrowings) ? data.borrowings : [],
      members: Array.isArray(data.members) ? data.members : [],
      holds: Array.isArray(data.holds) ? data.holds : [],
    };
  } catch {
    try {
      const example = JSON.parse(fs.readFileSync(exampleDbPath, 'utf8'));
      return { books: Array.isArray(example.books) ? example.books : [], borrowings: [], members: [], holds: [] };
    } catch {
      return { books: [], borrowings: [], members: [], holds: [] };
    }
  }
}
function writeDb(db) { fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`); }
function fail(res, status, message, code) { return res.status(status).json({ message, ...(code ? { code } : {}) }); }
function publicMember(member) {
  if (!member) return null;
  const { passwordHash, passwordSalt, ...safeMember } = member;
  return safeMember;
}
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function normalizeMemberId(value) { return String(value || '').trim().toLowerCase(); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
function validateBook(body) {
  if (!String(body?.title || '').trim()) return 'Book title is required.';
  if (String(body.title).trim().length > 160) return 'Book title must be 160 characters or fewer.';
  if (!String(body?.author || '').trim()) return 'Author is required.';
  if (String(body.author).trim().length > 120) return 'Author must be 120 characters or fewer.';
  if (!String(body?.category || '').trim()) return 'Category is required.';
  if (String(body.category).trim().length > 80) return 'Category must be 80 characters or fewer.';
  if (body.rating !== undefined && (!Number.isFinite(Number(body.rating)) || Number(body.rating) < 0 || Number(body.rating) > 5)) return 'Rating must be a number between 0 and 5.';
  if (body.publishedYear !== undefined && body.publishedYear !== null && body.publishedYear !== '' && (!Number.isInteger(Number(body.publishedYear)) || Number(body.publishedYear) < 0 || Number(body.publishedYear) > new Date().getFullYear())) return 'Publication year must be a valid year.';
  return null;
}
function accountKey(member) { return `account:${String(member.accountId).trim().toLowerCase()}`; }
function hasActiveBorrowing(db, bookId) {
  return db.borrowings.some((record) => String(record.bookId) === String(bookId) && record.status === 'borrowed');
}
function setBookAvailabilityFromLoans(db, book) {
  if (book) book.available = !hasActiveBorrowing(db, book.id);
}

function describeApiAction(req) {
  const pathname = req.path;
  if (pathname === '/api/open-library/search.json') return 'Open Library search data loaded';
  if (/^\/api\/open-library\/works\/[^/]+\.json$/.test(pathname)) return 'Open Library book details loaded';
  if (pathname === '/api/auth/register') return 'Member registration';
  if (pathname === '/api/auth/login') return 'Member login';
  if (pathname === '/api/auth/logout') return 'Member logout';
  if (pathname === '/api/auth/me') return 'Token verification';
  if (pathname === '/api/profile') return req.method === 'PATCH' ? 'Member profile update' : 'Member profile read';
  if (pathname === '/api/history') return 'Reading history loaded';
  if (pathname === '/api/holds') return req.method === 'POST' ? 'Hold request' : 'Hold list loaded';
  if (pathname === '/api/books') return req.method === 'POST' ? 'Book create' : 'Book catalogue read';
  if (/^\/api\/books\/[^/]+$/.test(pathname)) return ({ GET: 'Book detail read', PUT: 'Book replace', PATCH: 'Book partial update', DELETE: 'Book delete' })[req.method] || 'Book request';
  if (pathname === '/api/borrowings') return req.method === 'POST' ? 'Book checkout' : 'Borrowing list read';
  if (/^\/api\/borrowings\/[^/]+$/.test(pathname)) {
    const body = req.body || {};
    if ((req.method === 'PUT' || req.method === 'PATCH') && body.status === 'returned') return 'Book return';
    if ((req.method === 'PUT' || req.method === 'PATCH') && body.dueDate) return 'Book renewal';
    return ({ GET: 'Borrowing detail read', PUT: 'Borrowing replace', PATCH: 'Borrowing update', DELETE: 'Borrowing delete' })[req.method] || 'Borrowing request';
  }
  return 'Library API request';
}

// Show API activity in developer consoles only. No Activity Log screen or
// persisted audit table is maintained; request bodies and tokens are never logged.
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') || req.path === '/api/health') return next();
  res.on('finish', () => {
    const outcome = res.statusCode >= 400 ? 'FAILED' : 'OK';
    const write = res.statusCode >= 400 ? console.warn : console.info;
    write(`[Library API] ${describeApiAction(req)} | ${req.method} ${req.path} | HTTP ${res.statusCode} ${outcome}`);
  });
  next();
});
function issueToken(member) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  sessions.set(token, { accountId: member.accountId, expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}
function requireAuth(req, res, next) {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return fail(res, 401, 'Authentication token is required. Please sign in.', 'TOKEN_MISSING');
  const token = match[1].trim();
  const session = sessions.get(token);
  if (!session) return fail(res, 401, 'Authentication token is invalid or has been revoked. Please sign in again.', 'TOKEN_INVALID');
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return fail(res, 401, 'Your authentication token has expired. Please sign in again.', 'TOKEN_EXPIRED');
  }
  const db = readDb();
  const member = db.members.find((item) => item.accountId === session.accountId);
  if (!member) {
    sessions.delete(token);
    return fail(res, 401, 'The account for this token no longer exists. Please sign in again.', 'TOKEN_INVALID');
  }
  req.authToken = token;
  req.tokenExpiresAt = session.expiresAt;
  req.member = publicMember(member);
  req.memberRecord = member;
  next();
}
function getOwnedBorrowing(db, id, member) {
  return db.borrowings.find((record) => String(record.id) === String(id) && record.accountKey === accountKey(member));
}
function updateOwnedBorrowing(req, res, nextStatus) {
  const db = readDb();
  const index = db.borrowings.findIndex((record) => String(record.id) === String(req.params.id) && record.accountKey === accountKey(req.member));
  if (index < 0) return fail(res, 404, 'Borrowing record not found for this member.');
  const oldRecord = db.borrowings[index];
  const body = req.body || {};
  if (oldRecord.status !== 'borrowed' && (body.status || body.dueDate)) {
    return fail(res, 409, 'Only active borrowing records can be returned or renewed.');
  }
  const changes = {};
  if (body.dueDate !== undefined) {
    const due = String(body.dueDate);
    const validShape = /^\d{4}-\d{2}-\d{2}$/.test(due);
    const parsed = validShape ? new Date(`${due}T00:00:00.000Z`) : new Date('invalid');
    if (!validShape || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== due) {
      return fail(res, 400, 'A valid dueDate in YYYY-MM-DD format is required.');
    }
    changes.dueDate = due;
  }
  if (body.status !== undefined) {
    if (!['borrowed', 'returned'].includes(body.status)) return fail(res, 400, 'Status must be borrowed or returned.');
    if (oldRecord.status === 'returned' && body.status === 'borrowed') return fail(res, 409, 'A returned loan cannot be reactivated. Create a new borrowing record instead.');
    changes.status = body.status;
  }
  if (body.renewalCount !== undefined) {
    const count = Number(body.renewalCount);
    if (!Number.isInteger(count) || count < 0) return fail(res, 400, 'renewalCount must be a non-negative integer.');
    changes.renewalCount = count;
  }
  db.borrowings[index] = { ...oldRecord, ...changes };
  const transitionedToReturned = oldRecord.status === 'borrowed' && db.borrowings[index].status === 'returned';
  if (transitionedToReturned) {
    db.borrowings[index].returnedDate = new Date().toISOString().slice(0, 10);
  }
  const book = db.books.find((item) => String(item.id) === String(db.borrowings[index].bookId));
  if (transitionedToReturned) setBookAvailabilityFromLoans(db, book);
  writeDb(db);
  res.locals.updatedRecord = db.borrowings[index];
  nextStatus();
}

function replaceOwnedBorrowing(req, res) {
  const body = req.body || {};
  if (!body.status || !body.dueDate) return fail(res, 400, 'PUT requires the full mutable record fields: status and dueDate.');
  return updateOwnedBorrowing(req, res, () => res.json(res.locals.updatedRecord));
}

// Same-origin proxy for Open Library. This avoids browser cross-origin
// restrictions and keeps upstream headers under the local API's control.
// These endpoints are GET-only data reads; catalog CRUD still uses /api/books.
async function sendOpenLibraryJson(req, res, upstreamPath) {
  try {
    const target = new URL(upstreamPath, 'https://openlibrary.org');
    const allowedQueryKeys = new Set(['q', 'limit', 'fields', 'page', 'offset', 'sort', 'lang']);
    for (const [key, value] of Object.entries(req.query || {})) {
      if (!allowedQueryKeys.has(key) || value === undefined || value === null || Array.isArray(value)) continue;
      target.searchParams.set(key, String(value));
    }
    const response = await fetch(target, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LibraryManagementClassroomApp/1.0',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return fail(res, 502, `Open Library returned HTTP ${response.status}. Please retry shortly.`, 'OPEN_LIBRARY_UPSTREAM_ERROR');
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(data);
  } catch (error) {
    const reason = error?.name === 'TimeoutError'
      ? 'Open Library took too long to respond.'
      : 'Open Library could not be reached. Check the internet connection and retry.';
    return fail(res, 502, reason, 'OPEN_LIBRARY_UNAVAILABLE');
  }
}

app.get('/api/open-library/search.json', (req, res) => sendOpenLibraryJson(req, res, '/search.json'));
app.get('/api/open-library/works/:id.json', (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return fail(res, 400, 'Invalid Open Library work ID.');
  return sendOpenLibraryJson(req, res, `/works/${encodeURIComponent(id)}.json`);
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Library REST API with token authentication' }));

// Experiment 8: server-side registration and opaque, expiring bearer tokens.
app.post('/api/auth/register', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const memberId = String(body.memberId || '').trim();
  const email = normalizeEmail(body.email);
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '');
  const errors = {};
  if (name.length < 2) errors.name = 'Enter your full name.';
  if (!/^[A-Za-z]{2,10}[A-Za-z0-9-]{4,}$/.test(memberId)) errors.memberId = 'Use a member ID such as LIB2026001.';
  if (!validEmail(email)) errors.email = 'Enter a valid email address.';
  if (!/^\+?[0-9\s().-]{10,20}$/.test(phone)) errors.phone = 'Enter a valid phone number.';
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) errors.password = 'Password must be at least 8 characters and include a letter and number.';
  if (body.confirmPassword !== undefined && password !== String(body.confirmPassword)) errors.confirmPassword = 'Passwords do not match.';
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Please correct the registration fields.', errors });

  const db = readDb();
  if (db.members.some((member) => normalizeMemberId(member.memberId) === normalizeMemberId(memberId))) errors.memberId = 'This member ID is already registered.';
  if (db.members.some((member) => normalizeEmail(member.email) === email)) errors.email = 'This email is already registered.';
  if (Object.keys(errors).length) return res.status(409).json({ message: 'An account already uses these details.', errors });

  const passwordSalt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, passwordSalt, 64).toString('hex');
  const member = {
    accountId: randomUUID(), name, memberId, email, phone,
    membershipType: 'Standard', joinDate: new Date().toISOString().slice(0, 10),
    registeredAt: new Date().toISOString(), passwordSalt, passwordHash,
  };
  db.members.push(member);
  writeDb(db);
  res.status(201).json({ user: publicMember(member), message: 'Registration successful. Sign in to continue.' });
});

app.post('/api/auth/login', (req, res) => {
  const identifier = String(req.body?.identifier || req.body?.email || req.body?.memberId || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!identifier || !password) return fail(res, 400, 'Member ID or email and password are required.');
  const db = readDb();
  const member = db.members.find((item) => normalizeMemberId(item.memberId) === identifier || normalizeEmail(item.email) === identifier);
  if (!member) return fail(res, 401, 'Invalid member ID/email or password.', 'INVALID_CREDENTIALS');
  const actual = scryptSync(password, member.passwordSalt, 64);
  const expected = Buffer.from(member.passwordHash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return fail(res, 401, 'Invalid member ID/email or password.', 'INVALID_CREDENTIALS');
  }
  const auth = issueToken(member);
  res.json({ ...auth, user: publicMember(member), tokenType: 'Bearer' });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.member, expiresAt: new Date(req.tokenExpiresAt).toISOString() }));
app.post('/api/auth/logout', requireAuth, (req, res) => {
  sessions.delete(req.authToken);
  res.json({ message: 'Signed out. The token has been revoked.' });
});

// Profile and history endpoints expose only the authenticated member's own data.
app.get('/api/profile', requireAuth, (req, res) => res.json({ user: req.member }));
app.patch('/api/profile', requireAuth, (req, res) => {
  const db = readDb();
  const index = db.members.findIndex((member) => member.accountId === req.member.accountId);
  if (index < 0) return fail(res, 404, 'Member profile not found.');
  const body = req.body || {};
  const name = String(body.name ?? db.members[index].name).trim();
  const memberId = String(body.memberId ?? db.members[index].memberId).trim();
  const email = normalizeEmail(body.email ?? db.members[index].email);
  const phone = String(body.phone ?? db.members[index].phone).trim();
  const membershipType = String(body.membershipType ?? db.members[index].membershipType ?? 'Standard').trim();
  if (name.length < 2 || !/^[A-Za-z]{2,10}[A-Za-z0-9-]{4,}$/.test(memberId) || !validEmail(email) || !/^\+?[0-9\s().-]{10,20}$/.test(phone) || !membershipType) {
    return fail(res, 400, 'Enter a valid name, member ID, email, phone, and membership type.');
  }
  if (db.members.some((member) => member.accountId !== req.member.accountId && normalizeMemberId(member.memberId) === normalizeMemberId(memberId))) return fail(res, 409, 'This member ID belongs to another account.');
  if (db.members.some((member) => member.accountId !== req.member.accountId && normalizeEmail(member.email) === email)) return fail(res, 409, 'This email belongs to another account.');
  db.members[index] = { ...db.members[index], name, memberId, email, phone, membershipType };
  writeDb(db);
  res.json({ user: publicMember(db.members[index]) });
});
app.get('/api/history', requireAuth, (req, res) => {
  const db = readDb();
  const key = accountKey(req.member);
  const history = db.borrowings.filter((record) => record.accountKey === key && record.status === 'returned');
  res.json(history);
});

// Holds are persisted on the server and are private to the authenticated member.
app.get('/api/holds', requireAuth, (req, res) => {
  const db = readDb();
  res.json(db.holds.filter((hold) => hold.accountKey === accountKey(req.member)));
});
app.post('/api/holds', requireAuth, (req, res) => {
  const bookId = req.body?.bookId;
  const title = String(req.body?.title || '').trim();
  if (bookId === undefined || bookId === null || !title) return fail(res, 400, 'bookId and title are required to place a hold.');
  const db = readDb();
  const key = accountKey(req.member);
  const book = db.books.find((item) => String(item.id) === String(bookId));
  const existingHold = db.holds.find((hold) => hold.accountKey === key && String(hold.bookId) === String(bookId) && hold.status === 'Waiting');
  const existingOwnLoan = db.borrowings.find((record) => record.accountKey === key && String(record.bookId) === String(bookId) && record.status === 'borrowed');
  const existingAnyLoan = db.borrowings.find((record) => String(record.bookId) === String(bookId) && record.status === 'borrowed');

  if (existingOwnLoan) {
    return res.status(200).json({ decision: 'already_borrowed', code: 'ALREADY_CHECKED_OUT', message: 'This title is already checked out to your account.', record: existingOwnLoan });
  }

  // POST hold is idempotent: double-clicks/retries return the existing request.
  if (existingHold) {
    return res.status(200).json({ ...existingHold, alreadyExists: true, message: 'You already have an active hold for this book. No duplicate was created.' });
  }

  // Availability may have changed since the remote catalogue was fetched. Return
  // a typed business result instead of an HTTP 409 that looks like a crashed API.
  if (book?.available && !existingAnyLoan) {
    return res.status(200).json({
      decision: 'borrow_instead',
      code: 'BOOK_AVAILABLE',
      message: 'This book is now available. No hold was created; select Borrow to check it out.',
      book: { id: book.id, title: book.title, author: book.author, category: book.category, isbn: book.isbn, available: true, source: 'local-api' },
    });
  }

  if (!book) db.books.unshift({ id: bookId, title, author: String(req.body?.author || 'Author not listed'), category: String(req.body?.category || 'General'), isbn: String(req.body?.isbn || ''), rating: 0, description: '', available: false, source: 'api-book' });
  const hold = { id: randomUUID(), bookId, title, author: String(req.body?.author || 'Author not listed'), category: String(req.body?.category || 'General'), accountKey: key, accountId: req.member.accountId, memberName: req.member.name, requestedDate: new Date().toISOString().slice(0, 10), status: 'Waiting' };
  db.holds.unshift(hold);
  writeDb(db);
  res.status(201).json(hold);
});

// Book reads remain public. All book mutations require a valid token.
app.get('/api/books', (req, res) => {
  const db = readDb(); let books = db.books;
  const q = String(req.query.q || '').toLowerCase().trim();
  const category = String(req.query.category || '').toLowerCase().trim();
  if (q) books = books.filter((book) => `${book.title} ${book.author} ${book.isbn || ''}`.toLowerCase().includes(q));
  if (category && category !== 'all') books = books.filter((book) => String(book.category).toLowerCase() === category);
  res.json(books);
});
app.get('/api/books/:id', (req, res) => {
  const book = readDb().books.find((item) => String(item.id) === String(req.params.id));
  return book ? res.json(book) : fail(res, 404, 'Book not found.');
});
app.post('/api/books', requireAuth, (req, res) => {
  const error = validateBook(req.body); if (error) return fail(res, 400, error);
  const db = readDb();
  if (db.books.some((book) => String(book.id) === String(req.body.id) && req.body.id !== undefined)) return fail(res, 409, 'A book with this ID already exists.');
  const book = { id: req.body.id ?? Date.now(), title: String(req.body.title).trim(), author: String(req.body.author).trim(), category: String(req.body.category).trim(), isbn: String(req.body.isbn || '').trim(), rating: Number(req.body.rating || 0), description: String(req.body.description || '').trim(), publishedYear: req.body.publishedYear ? Number(req.body.publishedYear) : null, available: req.body.available !== false };
  db.books.unshift(book); writeDb(db); res.status(201).json(book);
});
app.put('/api/books/:id', requireAuth, (req, res) => {
  const error = validateBook(req.body); if (error) return fail(res, 400, error);
  const db = readDb(); const index = db.books.findIndex((book) => String(book.id) === String(req.params.id));
  if (index < 0) return fail(res, 404, 'Book not found.');
  if (req.body.available === true && hasActiveBorrowing(db, req.params.id)) return fail(res, 409, 'This book has an active loan and cannot be marked available until it is returned.');
  db.books[index] = { ...db.books[index], ...req.body, id: db.books[index].id, title: String(req.body.title).trim(), author: String(req.body.author).trim(), category: String(req.body.category).trim(), rating: Number(req.body.rating || 0), publishedYear: req.body.publishedYear ? Number(req.body.publishedYear) : null };
  writeDb(db); res.json(db.books[index]);
});
app.patch('/api/books/:id', requireAuth, (req, res) => {
  const db = readDb(); const index = db.books.findIndex((book) => String(book.id) === String(req.params.id));
  if (index < 0) return fail(res, 404, 'Book not found.');
  const merged = { ...db.books[index], ...req.body, id: db.books[index].id };
  const error = validateBook(merged); if (error) return fail(res, 400, error);
  if (req.body.available === true && hasActiveBorrowing(db, req.params.id)) return fail(res, 409, 'This book has an active loan and cannot be marked available until it is returned.');
  if (merged.rating !== undefined) merged.rating = Number(merged.rating);
  if (merged.publishedYear !== undefined && merged.publishedYear !== null && merged.publishedYear !== '') merged.publishedYear = Number(merged.publishedYear);
  db.books[index] = merged; writeDb(db); res.json(merged);
});
app.delete('/api/books/:id', requireAuth, (req, res) => {
  const db = readDb(); const book = db.books.find((item) => String(item.id) === String(req.params.id));
  if (!book) return fail(res, 404, 'Book not found.');
  if (db.borrowings.some((record) => String(record.bookId) === String(book.id) && record.status === 'borrowed')) return fail(res, 409, 'Return active borrowing records before deleting this book.');
  db.books = db.books.filter((item) => String(item.id) !== String(req.params.id)); writeDb(db); res.status(204).end();
});

// Borrowing endpoints only ever read or mutate records owned by the token's member.
app.get('/api/borrowings', requireAuth, (req, res) => {
  const db = readDb(); const key = accountKey(req.member);
  let records = db.borrowings.filter((record) => record.accountKey === key);
  if (req.query.status) records = records.filter((record) => record.status === String(req.query.status));
  res.json(records);
});
app.get('/api/borrowings/:id', requireAuth, (req, res) => {
  const record = getOwnedBorrowing(readDb(), req.params.id, req.member);
  return record ? res.json(record) : fail(res, 404, 'Borrowing record not found for this member.');
});
app.post('/api/borrowings', requireAuth, (req, res) => {
  const bookId = req.body?.bookId;
  const title = String(req.body?.title || '').trim();
  if (bookId === undefined || bookId === null || !title) return fail(res, 400, 'bookId and title are required.');
  const db = readDb(); const key = accountKey(req.member);
  const existing = db.borrowings.find((record) => String(record.bookId) === String(bookId) && record.accountKey === key && record.status === 'borrowed');
  if (existing) {
    return res.status(200).json({ ...existing, alreadyExists: true, message: 'This book is already checked out to your account. No duplicate loan was created.' });
  }
  const activeLoan = db.borrowings.find((record) => String(record.bookId) === String(bookId) && record.status === 'borrowed');
  let book = db.books.find((item) => String(item.id) === String(bookId));
  if (activeLoan || (book && !book.available)) {
    // Usually the catalogue record exists. Guard the inconsistent-database case too,
    // so an active loan with a missing book cannot cause a TypeError in the API.
    const unavailableBook = book || {
      id: activeLoan.bookId,
      title: activeLoan.title || title,
      author: activeLoan.author || String(req.body.author || 'Author not listed'),
      category: activeLoan.category || String(req.body.category || 'General'),
      isbn: activeLoan.isbn || String(req.body.isbn || ''),
    };
    return res.status(200).json({
      decision: 'hold_instead', code: 'BOOK_UNAVAILABLE',
      message: 'This book has just become unavailable. No loan was created; select Hold to join the waiting list.',
      book: { id: unavailableBook.id, title: unavailableBook.title, author: unavailableBook.author, category: unavailableBook.category, isbn: unavailableBook.isbn, available: false, source: 'local-api' },
    });
  }
  if (!book) {
    book = { id: bookId, title, author: String(req.body.author || 'Author not listed'), category: String(req.body.category || 'General'), isbn: String(req.body.isbn || ''), rating: Number(req.body.rating || 0), description: String(req.body.description || ''), publishedYear: req.body.publishedYear || null, coverUrl: String(req.body.coverUrl || ''), source: String(req.body.source || 'api-book'), available: true };
    db.books.unshift(book);
  }
  const today = new Date(); const due = new Date(today); due.setDate(due.getDate() + 14);
  const record = {
    id: randomUUID(), bookId: book.id, title: book.title, author: book.author, category: book.category || String(req.body.category || 'General'),
    isbn: book.isbn || '', rating: book.rating || 0, description: book.description || '',
    publishedYear: book.publishedYear || null, coverUrl: book.coverUrl || '', source: book.source || 'local-api',
    accountKey: key, accountId: req.member.accountId, memberName: req.member.name,
    borrowedDate: today.toISOString().slice(0, 10), dueDate: due.toISOString().slice(0, 10), status: 'borrowed', renewalCount: 0,
  };
  book.available = false; db.borrowings.unshift(record); writeDb(db); res.status(201).json(record);
});
app.put('/api/borrowings/:id', requireAuth, replaceOwnedBorrowing);
app.patch('/api/borrowings/:id', requireAuth, (req, res) => updateOwnedBorrowing(req, res, () => res.json(res.locals.updatedRecord)));
app.delete('/api/borrowings/:id', requireAuth, (req, res) => {
  const db = readDb(); const record = getOwnedBorrowing(db, req.params.id, req.member);
  if (!record) return fail(res, 404, 'Borrowing record not found for this member.');
  db.borrowings = db.borrowings.filter((item) => String(item.id) !== String(req.params.id));
  if (record.status === 'borrowed') { const book = db.books.find((item) => String(item.id) === String(record.bookId)); setBookAvailabilityFromLoans(db, book); }
  writeDb(db); res.status(204).end();
});

app.listen(PORT, () => console.log(`Library REST API running at http://localhost:${PORT} (token lifetime ${Math.round(TOKEN_TTL_MS / 60000)} min)`));
