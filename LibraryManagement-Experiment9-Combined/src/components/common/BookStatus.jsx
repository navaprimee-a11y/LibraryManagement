import React from 'react';

const BookStatus = ({ status, available, borrowed = false, held = false }) => {
  const label = status || (borrowed ? 'Borrowed by you' : available ? 'Available' : held ? 'Hold requested' : 'Unavailable');
  const tone = /overdue/i.test(label) ? 'overdue' : /borrowed|checked out/i.test(label) ? 'borrowed' : /available/i.test(label) && !/unavailable/i.test(label) ? 'available' : /hold/i.test(label) ? 'hold' : 'unavailable';
  return <span className={`book-status book-status--${tone}`} aria-label={`Book status: ${label}`}>{label}</span>;
};

export default BookStatus;
