import React from 'react';
import { render, screen } from '@testing-library/react';
import BookStatus from '../../src/components/common/BookStatus';
import Loading from '../../src/components/common/Loading';
import Recommendations from '../../src/components/Recommendations';

describe('Availability, loading, and error states', () => {
  test.each([
    [true, false, false, 'Available'],
    [false, true, false, 'Borrowed by you'],
    [false, false, true, 'Hold requested'],
    [false, false, false, 'Unavailable'],
  ])('shows the correct status for available=%s, borrowed=%s, held=%s', (available, borrowed, held, label) => {
    render(<BookStatus available={available} borrowed={borrowed} held={held} />);
    expect(screen.getByLabelText(`Book status: ${label}`)).toBeInTheDocument();
  });

  test('exposes a loading state to assistive technology', () => {
    render(<Loading label="Loading books from API…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading books from API');
  });
  test('shows recommendation loading and API fallback error messages', () => {
  render(
    <Recommendations
      recommendations={[]}
      onSelect={jest.fn()}
      loading
      error="Open Library is unavailable; showing local results."
    />
  );

  expect(
    screen.getByText(/Fetching recommendations from the REST API/i)
  ).toBeInTheDocument();

  expect(
    screen.getByText('Open Library is unavailable; showing local results.')
  ).toBeInTheDocument();

  expect(
    screen.getByText('No recommendations available right now.')
  ).toBeInTheDocument();
});
})
