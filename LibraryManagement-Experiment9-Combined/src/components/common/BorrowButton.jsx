import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';

const BorrowButton = ({ book, disabled = false, className = '' }) => {
  const navigate = useNavigate();
  const label = book?.available ? 'Borrow this book' : 'Request a hold';
  return (
    <Button
      type="button"
      className={className}
      disabled={disabled || !book}
      onClick={() => book && navigate(`/borrow-request/${book.id}`)}
      aria-label={`${label}: ${book?.title || 'book'}`}
    >
      {label} →
    </Button>
  );
};

export default BorrowButton;
