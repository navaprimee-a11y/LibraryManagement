import React from 'react';

const SearchBar = ({ searchInputRef, searchKeyword, setSearchKeyword }) => {
  return (
    <div className="search-bar">
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Search books by title or author..."
        value={searchKeyword}
        onChange={(e) => setSearchKeyword(e.target.value)}
        className="search-input"
      />
    </div>
  );
};

export default SearchBar;
