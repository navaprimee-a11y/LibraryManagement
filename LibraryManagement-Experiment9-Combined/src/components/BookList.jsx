import React from 'react';
import BookCard from './BookCard';

const BookList = ({ books, borrowedBooks = [], holdRequests = [] }) => {
  if (!books.length) return <p className="no-books">😕 No books found matching your filters.</p>;
  return <div className="book-list">
    {books.map((book) => <BookCard key={book.id} book={book}
      borrowed={borrowedBooks.some((item) => item.id === book.id)}
      held={holdRequests.some((item) => item.bookId === book.id && item.status === 'Waiting')} />)}
  </div>;
};

export default BookList;
