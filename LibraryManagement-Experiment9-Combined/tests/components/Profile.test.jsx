import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Profile from '../../src/components/Profile';
import { useAuth } from '../../src/context/AuthContext';
import useMemberApi from '../../src/hooks/useMemberApi';
import { getApiProfile, getAuthApiError } from '../../src/services/authApi';

jest.mock('../../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../src/hooks/useMemberApi', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../src/services/authApi', () => ({
  getApiProfile: jest.fn(),
  getAuthApiError: jest.fn((error) => error?.message || 'API request failed'),
}));

const user = { name: 'Test Member', memberId: 'LIB2026001', email: 'member@example.com', phone: '9876543210', membershipType: 'Standard', accountId: 'acct-test' };
const profile = { ...user };

beforeEach(() => {
  useAuth.mockReturnValue({ user, updateUser: jest.fn().mockResolvedValue({ ok: true }) });
  useMemberApi.mockReturnValue({ member: null, loading: false, error: '' });
  getApiProfile.mockResolvedValue({ user: profile });
});

describe('Member Profile', () => {
  test('loads and displays the protected member profile', async () => {
    render(<Profile memberInfo={user} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your protected member profile');
    expect(await screen.findByDisplayValue('member@example.com')).toBeInTheDocument();
    expect(getApiProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Member Profile' })).toBeInTheDocument();
  });

  test('shows an error message when the protected profile request fails', async () => {
    getApiProfile.mockRejectedValueOnce(new Error('Session expired'));
    render(<Profile memberInfo={user} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Session expired');
  });

  test('validates the profile before submitting updates', async () => {
    const updateUser = jest.fn().mockResolvedValue({ ok: true });
    useAuth.mockReturnValue({ user, updateUser });
    render(<Profile memberInfo={user} />);
    await screen.findByDisplayValue('member@example.com');
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Updated Member' } });
    fireEvent.click(screen.getByRole('button', { name: /Save profile changes/i }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Member' })));
    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved successfully');
  });
});
