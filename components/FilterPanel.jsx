export default function FilterPanel({ filters }) {
  const {
    selectedCategory, setSelectedCategory,
    selectedAuthor, setSelectedAuthor,
    maxRating, setMaxRating,
    categories, authors,
    resetFilters,
  } = filters;

  return (
    <div className="filter-panel">
      <label>
        <span>Category</span>
        <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
          <option value="All">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label>
        <span>Author</span>
        <select value={selectedAuthor} onChange={(event) => setSelectedAuthor(event.target.value)}>
          <option value="All">All authors</option>
          {authors.map((author) => <option key={author} value={author}>{author}</option>)}
        </select>
      </label>
      <label>
        <span>Minimum rating</span>
        <select value={maxRating} onChange={(event) => setMaxRating(Number(event.target.value))}>
          <option value={0}>Any rating</option>
          <option value={3}>3 stars and up</option>
          <option value={4}>4 stars and up</option>
          <option value={5}>5 stars only</option>
        </select>
      </label>
      <button className="button button-light reset-button" onClick={resetFilters}>Reset filters</button>
    </div>
  );
}
