import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BorrowConfirmation from '../../src/components/BorrowConfirmation';
import BorrowedBooks from '../../src/components/BorrowedBooks';
import { useAuth } from '../../src/context/AuthContext';

jest.mock('../../src/context/AuthContext', () => ({ useAuth: jest.fn() }));

const book = {
  id: 101, title: 'The Hobbit', author: 'J.R.R. Tolkien', category: 'Fantasy',
  publishedYear: 1937, rating: 5, available: true,
  borrowedDate: '2026-10-01', dueDate: '2026-10-15', renewalCount: 0,
};
const user = { name: 'Test Member', memberId: 'LIB2026001', email: 'member@example.com', phone: '9876543210' };

beforeEach(() => {
  useAuth.mockReturnValue({ user });
});

function renderConfirmation(onConfirm) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/confirmation/101', state: { requestType: 'borrow', borrowerDetails: user } }]}>
      <Routes>
        <Route path="/confirmation/:id" element={<BorrowConfirmation books={[book]} onConfirm={onConfirm} />} />
        <Route path="/member" element={<h2>Member dashboard</h2>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Borrowing and checkout components', () => {
  test('creates a borrow request when checkout confirmation succeeds', async () => {
    const onConfirm = jest.fn().mockResolvedValue({ ok: true, message: 'Book checked out.' });
    renderConfirmation(onConfirm);
    fireEvent.click(screen.getByRole('button', { name: /Confirm request and open dashboard/i }));
    expect(await screen.findByRole('heading', { name: 'Member dashboard' })).toBeInTheDocument();
    expect(onConfirm).toHaveBeenCalledWith(101, 'borrow');
  });

  test('displays the API failure message when checkout fails', async () => {
    const onConfirm = jest.fn().mockResolvedValue({ ok: false, message: 'This book is no longer available.' });
    renderConfirmation(onConfirm);
    fireEvent.click(screen.getByRole('button', { name: /Confirm request and open dashboard/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This book is no longer available.');
  });

  test('returns a borrowed book and announces the result', async () => {
    const onReturn = jest.fn().mockResolvedValue({ ok: true, message: 'The Hobbit was returned.' });
    render(<MemoryRouter><BorrowedBooks borrowedBooks={[book]} onReturn={onReturn} onRenew={jest.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Return book' }));
    expect(await screen.findByRole('status')).toHaveTextContent('The Hobbit was returned.');
    expect(onReturn).toHaveBeenCalledWith(101);
  });

  test('submits a valid renewal request and shows the resulting status', async () => {
    const onRenew = jest.fn().mockResolvedValue({ ok: true, message: 'Renewal approved. Due date updated.' });
    render(<MemoryRouter><BorrowedBooks borrowedBooks={[book]} onReturn={jest.fn()} onRenew={onRenew} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Request renewal' }));
    fireEvent.change(screen.getByLabelText(/Reason for renewal/i), { target: { value: 'I need more time to finish this book.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit renewal →' }));
    await waitFor(() => expect(onRenew).toHaveBeenCalledWith(101, 14, {
      reason: 'I need more time to finish this book.', email: user.email, phone: user.phone,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Renewal approved. Due date updated.');
  });

  test('shows the empty borrowing state', () => {
    render(<MemoryRouter><BorrowedBooks borrowedBooks={[]} onReturn={jest.fn()} onRenew={jest.fn()} /></MemoryRouter>);
    expect(screen.getByText('No borrowed books yet.')).toBeInTheDocument();
  });
});
