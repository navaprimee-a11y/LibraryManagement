import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchBar from '../../src/components/SearchBar';
import FilterPanel from '../../src/components/FilterPanel';
import { filterBooks } from '../../src/utils/bookFilters';

const books = [
  { id: 1, title: 'The Hobbit', author: 'J.R.R. Tolkien', category: 'Fantasy' },
  { id: 2, title: 'The Lord of the Rings', author: 'J.R.R. Tolkien', category: 'Fantasy' },
  { id: 3, title: 'Pride and Prejudice', author: 'Jane Austen', category: 'Classic' },
];

describe('Book search and filters', () => {
  test('search input reports the updated query', () => {
    const setSearchKeyword = jest.fn();
    render(<SearchBar searchInputRef={{ current: null }} searchKeyword="" setSearchKeyword={setSearchKeyword} />);
    fireEvent.change(screen.getByPlaceholderText(/Search books by title or author/i), { target: { value: 'hobbit' } });
    expect(setSearchKeyword).toHaveBeenCalledWith('hobbit');
  });

  test('category and author controls report selected filters', () => {
    const setSelectedCategory = jest.fn();
    const setSelectedAuthor = jest.fn();
    render(<FilterPanel filters={{
      selectedCategory: 'All', setSelectedCategory,
      selectedAuthor: 'All', setSelectedAuthor,
      categories: ['Classic', 'Fantasy'], authors: ['Jane Austen', 'J.R.R. Tolkien'],
    }} />);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Fantasy' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Jane Austen' } });
    expect(setSelectedCategory).toHaveBeenCalledWith('Fantasy');
    expect(setSelectedAuthor).toHaveBeenCalledWith('Jane Austen');
  });

  test('filters by case-insensitive title or author search', () => {
    expect(filterBooks(books, { searchKeyword: 'TOLKIEN' }).map((book) => book.id)).toEqual([1, 2]);
    expect(filterBooks(books, { searchKeyword: 'prejudice' }).map((book) => book.id)).toEqual([3]);
  });

  test('combines category and search filters', () => {
    expect(filterBooks(books, { searchKeyword: 'the', selectedCategory: 'Fantasy' }).map((book) => book.id)).toEqual([1, 2]);
    expect(filterBooks(books, { searchKeyword: 'the', selectedCategory: 'Classic' })).toEqual([]);
  });
});
