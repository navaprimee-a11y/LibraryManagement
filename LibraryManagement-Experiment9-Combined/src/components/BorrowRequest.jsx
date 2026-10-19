import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateBorrowRequest } from '../utils/validation';
import Button from './common/Button';
import Input from './common/Input';
import BookStatus from './common/BookStatus';

const BorrowRequest = ({ books, borrowedBooks = [], holdRequests = [] }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const book = books.find((item) => String(item.id) === String(id));
  const [requestType, setRequestType] = useState(book?.available ? 'borrow' : 'hold');
  const [details, setDetails] = useState({ memberId: user?.memberId || '', email: user?.email || '', phone: user?.phone || '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  if (!book) return <section className="page-panel"><h2>Book not found</h2><Link to="/books">Return to catalogue</Link></section>;
  const alreadyBorrowed = borrowedBooks.some((item) => String(item.id) === String(book.id));
  const alreadyHeld = holdRequests.some((item) => String(item.bookId) === String(book.id) && item.status === 'Waiting');

  const handleChange = (event) => {
    setDetails((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: '' }));
    setFormError('');
  };

  const submit = (event) => {
    event.preventDefault();
    setFormError('');
    const nextErrors = validateBorrowRequest(details);
    if (alreadyBorrowed) setFormError('You already have this book checked out.');
    else if (requestType === 'borrow' && !book.available) setFormError('This book is unavailable. Choose Hold Request instead.');
    else if (requestType === 'hold' && book.available) setFormError('This book is available. Choose Borrow Request instead.');
    else if (requestType === 'hold' && alreadyHeld) setFormError('You already have an active hold request for this book.');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || alreadyBorrowed || (requestType === 'borrow' && !book.available) || (requestType === 'hold' && book.available) || (requestType === 'hold' && alreadyHeld)) return;
    navigate(`/confirmation/${book.id}`, { state: { requestType, borrowerDetails: details } });
  };

  return <section className="page-panel narrow-panel">
    <p className="eyebrow">STEP 2 OF 5</p><h2>Borrow / Hold Request</h2>
    <div className="request-book"><strong>{book.title}</strong><span>{book.author}</span><BookStatus available={book.available} borrowed={alreadyBorrowed} held={alreadyHeld} /></div>
    <form onSubmit={submit} className="request-form" noValidate>
      <fieldset className="request-options"><legend>Choose a request type</legend>
        <label className={`request-option ${requestType === 'borrow' ? 'selected' : ''}`}>
          <input type="radio" name="requestType" value="borrow" checked={requestType === 'borrow'} onChange={() => setRequestType('borrow')} disabled={!book.available || alreadyBorrowed} />
          <span><strong>Borrow book</strong><small>Check it out for 14 days. Renewal requests can be made from Borrowed Books.</small></span>
        </label>
        <label className={`request-option ${requestType === 'hold' ? 'selected' : ''}`}>
          <input type="radio" name="requestType" value="hold" checked={requestType === 'hold'} onChange={() => setRequestType('hold')} disabled={book.available || alreadyHeld} />
          <span><strong>Place a hold</strong><small>Join the hold list while this title is unavailable.</small></span>
        </label>
      </fieldset>
      <div className="form-section-heading"><h3>Member details</h3><p>Confirm the contact information associated with this request.</p></div>
      <Input label="Member ID" name="memberId" value={details.memberId} onChange={handleChange} required error={errors.memberId} />
      <Input label="Email address" name="email" type="email" value={details.email} onChange={handleChange} required error={errors.email} />
      <Input label="Phone number" name="phone" type="tel" value={details.phone} onChange={handleChange} required placeholder="10–15 digits, include country code if needed" error={errors.phone} />
      {formError && <p className="error-message" role="alert">{formError}</p>}
      <Button type="submit">Review request →</Button>
      <p><Link to={`/book/${book.id}`}>← Back to book details</Link></p>
    </form>
  </section>;
};

export default BorrowRequest;
