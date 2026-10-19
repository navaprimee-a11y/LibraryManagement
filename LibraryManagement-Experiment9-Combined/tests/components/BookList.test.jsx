import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookList from '../../src/components/BookList';

const books = [
  { id: 1, title: 'The Hobbit', author: 'J.R.R. Tolkien', category: 'Fantasy', rating: 5, publishedYear: 1937, available: true },
  { id: 2, title: 'Pride and Prejudice', author: 'Jane Austen', category: 'Classic', rating: 4, publishedYear: 1813, available: false },
];

describe('BookList', () => {
  test('renders a card for each book', () => {
    render(<MemoryRouter><BookList books={books} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'The Hobbit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pride and Prejudice' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  test('shows a useful empty state when no books match', () => {
    render(<MemoryRouter><BookList books={[]} /></MemoryRouter>);
    expect(screen.getByText(/No books found matching your filters/i)).toBeInTheDocument();
  });

  test('shows borrowed and held state passed to each card', () => {
    render(<MemoryRouter><BookList books={books} borrowedBooks={[{ id: 1 }]} holdRequests={[{ bookId: 2, status: 'Waiting' }]} /></MemoryRouter>);
    expect(screen.getByLabelText('Book status: Borrowed by you')).toBeInTheDocument();
    expect(screen.getByLabelText('Book status: Hold requested')).toBeInTheDocument();
  });
});
