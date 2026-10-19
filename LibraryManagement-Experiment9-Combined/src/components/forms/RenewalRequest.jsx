import React, { useState } from 'react';
import { validateRenewalRequest } from '../../utils/validation';
import Button from '../common/Button';
import Input from '../common/Input';

const RenewalRequest = ({ book, user, onCancel, onSubmit }) => {
  const [form, setForm] = useState({
    days: '14',
    reason: '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: '' }));
    setMessage('');
    setSubmitError(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateRenewalRequest(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const result = await onSubmit(book.id, Number(form.days), { reason: form.reason.trim(), email: form.email.trim(), phone: form.phone.trim() });
      if (!result?.ok) {
        setMessage(result?.message || 'The renewal request could not be completed.');
        setSubmitError(true);
        return;
      }
      setMessage(result.message);
    } finally { setSubmitting(false); }
  };

  return (
    <form className="renewal-form" onSubmit={submit} noValidate aria-label={`Renewal request for ${book.title}`}>
      <div className="renewal-form-heading"><h5>Renewal request</h5><p>Tell us why you need extra time for this title.</p></div>
      <Input label="Extension period" name="days" as="select" value={form.days} onChange={handleChange} required options={[
        { value: '7', label: '7 additional days' },
        { value: '14', label: '14 additional days' },
      ]} />
      <Input label="Reason for renewal" name="reason" as="textarea" value={form.reason} onChange={handleChange} required rows={3} placeholder="For example, I need more time to finish the final chapters." error={errors.reason} />
      <div className="form-grid-two">
        <Input label="Contact email" name="email" type="email" value={form.email} onChange={handleChange} required error={errors.email} />
        <Input label="Phone number" name="phone" type="tel" value={form.phone} onChange={handleChange} required placeholder="10–15 digits" error={errors.phone} />
      </div>
      {message && <p className={submitError ? 'error-message' : 'notice'} role={submitError ? 'alert' : 'status'}>{message}</p>}
      <div className="form-actions"><Button type="submit" disabled={submitting}>{submitting ? 'Updating protected loan…' : 'Submit renewal →'}</Button><Button variant="secondary" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
};

export default RenewalRequest;
