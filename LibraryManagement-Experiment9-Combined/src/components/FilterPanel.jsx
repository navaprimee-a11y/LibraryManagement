import React from 'react';

const FilterPanel = ({ filters }) => {
  const {
    selectedCategory, setSelectedCategory,
    selectedAuthor, setSelectedAuthor,
    categories, authors,
  } = filters;

  return (
    <div className="filter-panel">
      <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
        <option value="All">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <select value={selectedAuthor} onChange={(e) => setSelectedAuthor(e.target.value)}>
        <option value="All">All Authors</option>
        {authors.map((author) => (
          <option key={author} value={author}>{author}</option>
        ))}
      </select>


    </div>
  );
};

export default FilterPanel;
