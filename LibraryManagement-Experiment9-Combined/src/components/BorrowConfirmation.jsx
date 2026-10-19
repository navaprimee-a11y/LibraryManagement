import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './common/Button';

const BorrowConfirmation = ({ books, onConfirm }) => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const book = books.find((item) => String(item.id) === String(id));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requestType = location.state?.requestType || (book?.available ? 'borrow' : 'hold');
  const borrowerDetails = location.state?.borrowerDetails || user || {};
  if (!book) return <section className="page-panel"><h2>Book not found</h2><Link to="/books">Return to catalogue</Link></section>;

  const confirm = async () => {
    setError('');
    setSubmitting(true);
    try {
      const result = await onConfirm(book.id, requestType);
      if (!result?.ok) { setError(result?.message || 'The request could not be completed.'); return; }
      navigate('/member', { replace: true, state: { confirmationMessage: result.message } });
    } finally { setSubmitting(false); }
  };

  return <section className="page-panel narrow-panel">
    <p className="eyebrow">STEP 3 OF 5</p><h2>Review your request</h2>
    <p>Check the book and member details before submitting your request to the library.</p>
    <div className="confirmation-receipt">
      <p><strong>Book:</strong> {book.title}</p>
      <p><strong>Author:</strong> {book.author}</p>
      <p><strong>Request type:</strong> {requestType === 'borrow' ? 'Borrow request' : 'Hold request'}</p>
      <p><strong>Book ID:</strong> {book.id}</p>
      {requestType === 'borrow' && <p><strong>Loan period:</strong> 14 days from checkout</p>}
      <hr />
      <p><strong>Member ID:</strong> {borrowerDetails.memberId || 'Not provided'}</p>
      <p><strong>Email:</strong> {borrowerDetails.email || 'Not provided'}</p>
      <p><strong>Phone:</strong> {borrowerDetails.phone || 'Not provided'}</p>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <Button onClick={confirm} disabled={submitting}>{submitting ? 'Submitting secure request…' : 'Confirm request and open dashboard →'}</Button>
    <p><Link to={`/borrow-request/${book.id}`}>← Edit request</Link></p>
  </section>;
};

export default BorrowConfirmation;
