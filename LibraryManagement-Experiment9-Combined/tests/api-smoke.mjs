import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'library-api-smoke-'));
const temporaryDb = path.join(temporaryRoot, 'db.json');
let serverProcess;
let output = '';

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 12000;
  let lastError;
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`API server exited early. Output:\n${output}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
      lastError = new Error(`Health endpoint returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw new Error(`API server did not become ready: ${lastError?.message || 'timeout'}\n${output}`);
}

async function request(baseUrl, route, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { response, data };
}

function expectStatus(result, status, label) {
  assert.equal(result.response.status, status, `${label}: expected HTTP ${status}, received HTTP ${result.response.status}; response=${JSON.stringify(result.data)}`);
}

try {
  const sampleDb = await readFile(path.join(projectRoot, 'server/db.example.json'), 'utf8');
  await writeFile(temporaryDb, sampleDb, 'utf8');
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: projectRoot,
    env: { ...process.env, API_PORT: String(port), LIBRARY_DB_PATH: temporaryDb, AUTH_TOKEN_TTL_MS: '3600000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', (chunk) => { output += chunk.toString(); });
  serverProcess.stderr.on('data', (chunk) => { output += chunk.toString(); });
  await waitForHealth(baseUrl);

  // CORS: expose all requested HTTP methods and answer preflight requests.
  const allowedMethods = 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS';
  const preflight = await fetch(`${baseUrl}/api/books`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(preflight.status, 204, 'CORS preflight should return 204');
  assert.equal(preflight.headers.get('access-control-allow-methods'), allowedMethods, 'CORS must allow GET, HEAD, PUT, PATCH, POST, DELETE and OPTIONS');
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173', 'CORS must echo the configured frontend origin');
  const corsGet = await fetch(`${baseUrl}/api/books`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(corsGet.headers.get('access-control-allow-methods'), allowedMethods, 'CORS method header should be present on normal API responses too');

  // Public GET works, but protected mutations require a bearer token.
  const initialBooks = await request(baseUrl, '/api/books');
  expectStatus(initialBooks, 200, 'GET books');
  assert.ok(Array.isArray(initialBooks.data), 'GET books must return an array');
  const blockedPost = await request(baseUrl, '/api/books', {
    method: 'POST', body: { title: 'Must be blocked', author: 'Smoke Test', category: 'Testing' },
  });
  expectStatus(blockedPost, 401, 'Unauthenticated POST books');

  const suffix = `${Date.now()}`;
  const registration = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: {
      name: 'CRUD Test Member', memberId: `TST${suffix}`, email: `crud-${suffix}@example.test`,
      phone: '9999999999', password: 'LibraryTest123', confirmPassword: 'LibraryTest123',
    },
  });
  expectStatus(registration, 201, 'Register test member');
  const login = await request(baseUrl, '/api/auth/login', {
    method: 'POST', body: { identifier: registration.data.user.memberId, password: 'LibraryTest123' },
  });
  expectStatus(login, 200, 'Login test member');
  assert.ok(login.data.token, 'Login must return a bearer token');
  const token = login.data.token;

  // BOOK CRUD: POST, GET collection/detail, PUT, PATCH, DELETE.
  const bookId = `crud-smoke-${suffix}`;
  const newBook = {
    id: bookId, title: 'CRUD Smoke Test Book', author: 'Test Author', category: 'Testing',
    isbn: 'TEST-CRUD-001', rating: 4, description: 'Created by the API smoke test.',
    publishedYear: 2024, available: true,
  };
  const createdBook = await request(baseUrl, '/api/books', { method: 'POST', token, body: newBook });
  expectStatus(createdBook, 201, 'POST book');
  assert.equal(String(createdBook.data.id), bookId);

  const bookListAfterCreate = await request(baseUrl, '/api/books');
  expectStatus(bookListAfterCreate, 200, 'GET book collection after create');
  assert.ok(bookListAfterCreate.data.some((book) => String(book.id) === bookId), 'Created book should appear in GET list');
  const bookDetail = await request(baseUrl, `/api/books/${encodeURIComponent(bookId)}`);
  expectStatus(bookDetail, 200, 'GET book detail');

  const putBook = await request(baseUrl, `/api/books/${encodeURIComponent(bookId)}`, {
    method: 'PUT', token,
    body: { ...createdBook.data, title: 'CRUD Smoke Test Book (PUT)', author: 'Updated Author', category: 'Testing', available: true },
  });
  expectStatus(putBook, 200, 'PUT book');
  assert.equal(putBook.data.title, 'CRUD Smoke Test Book (PUT)');

  const patchBook = await request(baseUrl, `/api/books/${encodeURIComponent(bookId)}`, {
    method: 'PATCH', token, body: { description: 'Partially updated by PATCH.' },
  });
  expectStatus(patchBook, 200, 'PATCH book');
  assert.equal(patchBook.data.description, 'Partially updated by PATCH.');

  // BORROWING CRUD: create, get, PUT replace, PATCH renew/return, DELETE.
  const createdLoan = await request(baseUrl, '/api/borrowings', {
    method: 'POST', token,
    body: { bookId, title: putBook.data.title, author: putBook.data.author, category: putBook.data.category, isbn: putBook.data.isbn },
  });
  expectStatus(createdLoan, 201, 'POST borrowing');
  assert.equal(createdLoan.data.status, 'borrowed');
  const duplicateLoan = await request(baseUrl, '/api/borrowings', {
    method: 'POST', token,
    body: { bookId, title: putBook.data.title, author: putBook.data.author, category: putBook.data.category, isbn: putBook.data.isbn },
  });
  expectStatus(duplicateLoan, 200, 'Duplicate POST borrowing should be idempotent');
  assert.equal(duplicateLoan.data.alreadyExists, true, 'Duplicate checkout should reuse the active loan');

  const deleteActiveBook = await request(baseUrl, `/api/books/${encodeURIComponent(bookId)}`, { method: 'DELETE', token });
  expectStatus(deleteActiveBook, 409, 'DELETE book with active loan should be blocked');

  const borrowingList = await request(baseUrl, '/api/borrowings', { token });
  expectStatus(borrowingList, 200, 'GET borrowings');
  assert.ok(borrowingList.data.some((record) => record.id === createdLoan.data.id), 'Created loan should appear in GET list');
  const borrowingDetail = await request(baseUrl, `/api/borrowings/${encodeURIComponent(createdLoan.data.id)}`, { token });
  expectStatus(borrowingDetail, 200, 'GET borrowing detail');

  const putLoan = await request(baseUrl, `/api/borrowings/${encodeURIComponent(createdLoan.data.id)}`, {
    method: 'PUT', token,
    body: { status: 'borrowed', dueDate: createdLoan.data.dueDate, renewalCount: 0 },
  });
  expectStatus(putLoan, 200, 'PUT borrowing');

  const nextDue = new Date(`${createdLoan.data.dueDate}T00:00:00.000Z`);
  nextDue.setUTCDate(nextDue.getUTCDate() + 14);
  const renewedLoan = await request(baseUrl, `/api/borrowings/${encodeURIComponent(createdLoan.data.id)}`, {
    method: 'PATCH', token,
    body: { dueDate: nextDue.toISOString().slice(0, 10), renewalCount: 1 },
  });
  expectStatus(renewedLoan, 200, 'PATCH borrowing renewal');
  assert.equal(renewedLoan.data.renewalCount, 1);

  const returnedLoan = await request(baseUrl, `/api/borrowings/${encodeURIComponent(createdLoan.data.id)}`, {
    method: 'PATCH', token, body: { status: 'returned' },
  });
  expectStatus(returnedLoan, 200, 'PATCH borrowing return');
  assert.equal(returnedLoan.data.status, 'returned');
  assert.ok(returnedLoan.data.returnedDate, 'Returned loan should include returnedDate');
  const history = await request(baseUrl, '/api/history', { token });
  expectStatus(history, 200, 'GET reading history');
  assert.ok(history.data.some((record) => record.id === createdLoan.data.id), 'Returned loan should appear in history');

  // A second POST is allowed after return. DELETE must free the catalogue book.
  const secondLoan = await request(baseUrl, '/api/borrowings', {
    method: 'POST', token,
    body: { bookId, title: putBook.data.title, author: putBook.data.author, category: putBook.data.category, isbn: putBook.data.isbn },
  });
  expectStatus(secondLoan, 201, 'POST borrowing after return');
  const deletedLoan = await request(baseUrl, `/api/borrowings/${encodeURIComponent(secondLoan.data.id)}`, { method: 'DELETE', token });
  expectStatus(deletedLoan, 204, 'DELETE borrowing');

  // The seeded unavailable title exercises idempotent POST /api/holds behavior.
  const firstHold = await request(baseUrl, '/api/holds', {
    method: 'POST', token,
    body: { bookId: 109, title: 'The Lord of the Rings', author: 'J.R.R. Tolkien', category: 'Fantasy' },
  });
  expectStatus(firstHold, 201, 'POST hold');
  const duplicateHold = await request(baseUrl, '/api/holds', {
    method: 'POST', token,
    body: { bookId: 109, title: 'The Lord of the Rings', author: 'J.R.R. Tolkien', category: 'Fantasy' },
  });
  expectStatus(duplicateHold, 200, 'Duplicate POST hold should be idempotent');
  assert.equal(duplicateHold.data.alreadyExists, true, 'Duplicate hold should reuse the existing request');

  const deletedBook = await request(baseUrl, `/api/books/${encodeURIComponent(bookId)}`, { method: 'DELETE', token });
  expectStatus(deletedBook, 204, 'DELETE book');
  const absentBook = await request(baseUrl, `/api/books/${encodeURIComponent(bookId)}`);
  expectStatus(absentBook, 404, 'GET deleted book');

  const logout = await request(baseUrl, '/api/auth/logout', { method: 'POST', token, body: {} });
  expectStatus(logout, 200, 'Logout');
  const revokedRequest = await request(baseUrl, '/api/borrowings', { token });
  expectStatus(revokedRequest, 401, 'Revoked token should not access borrowing records');

  console.log('PASS: GET/POST/PUT/PATCH/DELETE book CRUD');
  console.log('PASS: GET/POST/PUT/PATCH/DELETE borrowing CRUD, return, renewal, and reading history');
  console.log('PASS: hold POST is idempotent and unauthenticated/ revoked protected requests are rejected');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  if (output) console.error(`API output:\n${output}`);
  process.exitCode = 1;
} finally {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => serverProcess.once('exit', resolve)),
      delay(1500),
    ]);
    if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}
