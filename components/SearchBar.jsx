export default function SearchBar({ searchInputRef, searchKeyword, setSearchKeyword }) {
  return (
    <label className="search-bar">
      <span aria-hidden="true">⌕</span>
      <input
        ref={searchInputRef}
        type="search"
        value={searchKeyword}
        onChange={(event) => setSearchKeyword(event.target.value)}
        placeholder="Search by book title or author..."
        aria-label="Search books by title or author"
      />
      {searchKeyword && <button className="text-button" onClick={() => setSearchKeyword('')} type="button">Clear</button>}
    </label>
  );
}
