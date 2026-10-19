import axios from 'axios';

const OPEN_LIBRARY_URL = '/api/open-library';
const SEARCH_FIELDS = [
  'key', 'title', 'author_name', 'first_publish_year', 'subject', 'isbn',
  'cover_i', 'ratings_average', 'first_sentence', 'edition_count',
].join(',');

const openLibraryClient = axios.create({
  baseURL: OPEN_LIBRARY_URL,
  timeout: 12000,
  headers: { Accept: 'application/json' },
});

export const categoryFromSubjects = (subjects = []) => {
  const value = (Array.isArray(subjects) ? subjects : [])
    .filter((subject) => typeof subject === 'string')
    .join(' ')
    .toLowerCase();

  const categoryRules = [
    [/science fiction|sci-fi|dystopia/, 'Science Fiction'],
    [/historical fiction/, 'Historical Fiction'],
    [/fantasy|magic|myth/, 'Fantasy'],
    [/romance|love stories/, 'Romance'],
    [/mystery|detective|crime/, 'Mystery'],
    [/adventure|exploration/, 'Adventure'],
    [/biography|autobiography|memoir/, 'Biography'],
    [/history|historical/, 'History'],
    [/poetry|poems/, 'Poetry'],
    [/children|juvenile/, 'Children'],
    [/nonfiction|non-fiction|science/, 'Nonfiction'],
    [/fiction|novel|literature/, 'Fiction'],
  ];

  const match = categoryRules.find(([pattern]) => pattern.test(value));
  if (match) return match[1];
  const firstSubject = (subjects || []).find((subject) => typeof subject === 'string' && subject.trim());
  return firstSubject ? firstSubject.trim().slice(0, 40) : 'General';
};

const workIdFromKey = (key) => String(key || '').split('/').filter(Boolean).pop() || '';

export const mapOpenLibrarySearchResult = (doc, existing = null) => {
  const workKey = doc?.key?.startsWith('/works/') ? doc.key : `/works/${workIdFromKey(doc?.key)}`;
  const id = workIdFromKey(workKey);
  if (!id || !doc?.title) return null;

  const firstSentence = Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : doc.first_sentence;
  return {
    ...(existing || {}),
    id,
    workKey,
    source: 'openlibrary',
    title: doc.title,
    author: Array.isArray(doc.author_name) && doc.author_name.length ? doc.author_name[0] : 'Author not listed',
    category: categoryFromSubjects(doc.subject),
    isbn: Array.isArray(doc.isbn) && doc.isbn.length ? doc.isbn[0] : 'Not listed',
    rating: Number.isFinite(Number(doc.ratings_average))
      ? Math.max(0, Math.min(5, Math.round(Number(doc.ratings_average))))
      : (existing?.rating ?? 0),
    description: firstSentence || existing?.description || 'Open the book details to fetch more information from Open Library.',
    publishedYear: doc.first_publish_year || existing?.publishedYear || null,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : (existing?.coverUrl || ''),
    available: existing?.available ?? true,
  };
};

export const mergeCatalogue = (current = [], incoming = []) => {
  const catalogue = new Map((Array.isArray(current) ? current : []).map((book) => [String(book.id), book]));

  (Array.isArray(incoming) ? incoming : []).forEach((book) => {
    if (!book || book.id === undefined || book.id === null) return;
    const key = String(book.id);
    const previous = catalogue.get(key);
    catalogue.set(key, previous
      ? { ...previous, ...book, available: book.source === 'local-api' ? book.available : previous.available }
      : book);
  });

  // Keep this browser-only demo catalogue small enough for localStorage.
  return [...catalogue.values()].slice(-250);
};

export const searchBooksFromApi = async (query = '', { signal, limit = 30 } = {}) => {
  const trimmedQuery = String(query || '').trim();
  const params = {
    q: trimmedQuery || 'subject:fiction',
    limit,
    fields: SEARCH_FIELDS,
  };
  const response = await openLibraryClient.get('/search.json', { params, signal });
  const docs = Array.isArray(response.data?.docs) ? response.data.docs : [];
  return docs.map((doc) => mapOpenLibrarySearchResult(doc)).filter(Boolean);
};

export const searchRecommendationsFromApi = async (category = 'Fiction', { signal, limit = 6 } = {}) => {
  const safeCategory = String(category || 'Fiction').replace(/["\\]/g, '').trim() || 'Fiction';
  const response = await openLibraryClient.get('/search.json', {
    params: { q: `subject:"${safeCategory}"`, limit, fields: SEARCH_FIELDS },
    signal,
  });
  const docs = Array.isArray(response.data?.docs) ? response.data.docs : [];
  return docs.map((doc) => mapOpenLibrarySearchResult(doc)).filter(Boolean);
};

export const fetchOpenLibraryWork = async (workKey, signal) => {
  const workId = workIdFromKey(workKey);
  if (!workId) throw new Error('A valid Open Library work ID is required.');

  const response = await fetch(`${OPEN_LIBRARY_URL}/works/${encodeURIComponent(workId)}.json`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Book details request failed (HTTP ${response.status}).`);
  return response.json();
};

export const mapOpenLibraryWork = (workId, data = {}) => {
  const workKey = `/works/${workIdFromKey(workId)}`;
  const id = workIdFromKey(workId);
  const description = typeof data.description === 'string'
    ? data.description
    : data.description?.value;
  const coverId = Array.isArray(data.covers) ? data.covers.find((cover) => Number(cover) > 0) : null;

  return {
    id,
    workKey,
    source: 'openlibrary',
    title: data.title || 'Untitled book',
    author: 'Author details are not available in this response',
    category: categoryFromSubjects(data.subjects),
    isbn: 'Not listed',
    rating: 0,
    description: description || 'No description was provided by Open Library for this title.',
    publishedYear: data.first_publish_date || null,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '',
    available: true,
  };
};

// Resolve locally seeded Experiment 4 titles to an Open Library work key so their
// detail page can also request live metadata instead of only showing static fields.
export const findOpenLibraryWorkKey = async (title, author = '', signal) => {
  const cleanTitle = String(title || '').replace(/["\\]/g, '').trim();
  if (!cleanTitle) return null;
  const response = await openLibraryClient.get('/search.json', {
    params: { q: `title:"${cleanTitle}"`, limit: 8, fields: 'key,title,author_name' },
    signal,
  });
  const docs = Array.isArray(response.data?.docs) ? response.data.docs : [];
  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const wantedTitle = normalize(title);
  const wantedAuthor = normalize(author);
  const exactTitleResults = docs.filter((doc) => normalize(doc.title) === wantedTitle);
  const candidates = exactTitleResults.length ? exactTitleResults : docs;
  const matched = candidates.find((doc) => {
    const authors = (doc.author_name || []).map(normalize);
    return !wantedAuthor || authors.some((candidate) => candidate.includes(wantedAuthor) || wantedAuthor.includes(candidate));
  }) || candidates[0];
  return matched?.key || null;
};
