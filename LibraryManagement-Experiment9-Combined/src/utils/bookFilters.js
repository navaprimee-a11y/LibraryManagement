/** Pure catalogue filtering logic, kept separate so it can be tested without mounting the app. */
export const filterBooks = (
  books = [],
  { searchKeyword = '', selectedCategory = 'All', selectedAuthor = 'All' } = {},
) => {
  const query = String(searchKeyword).trim().toLowerCase();
  return books.filter((book) => {
    const title = String(book.title || '').toLowerCase();
    const author = String(book.author || '').toLowerCase();
    const matchesSearch = !query || title.includes(query) || author.includes(query);
    const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
    const matchesAuthor = selectedAuthor === 'All' || book.author === selectedAuthor;
    return matchesSearch && matchesCategory && matchesAuthor;
  });
};
