import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateRegister } from '../utils/validation';
import Button from './common/Button';
import Input from './common/Input';

const emptyForm = {
  name: '',
  memberId: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

const Register = () => {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { registerMember, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const requestedPath = location.state?.from;
  const redirectTo = typeof requestedPath === 'string' && requestedPath.startsWith('/') && !requestedPath.startsWith('//')
    ? requestedPath
    : '/';

  if (isAuthenticated) return <Navigate to="/member" replace />;

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: '', form: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateRegister(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    const result = await registerMember(form);
    setSubmitting(false);
    if (!result.ok) {
      setErrors(result.errors || { form: 'Registration could not be completed.' });
      return;
    }

    // Registration does not automatically sign the member in: they must log in afterward.
    navigate('/login', {
      replace: true,
      state: {
        registered: true,
        identifier: result.user.email,
        from: redirectTo === '/' ? undefined : redirectTo,
      },
    });
  };

  return (
    <section className="auth-screen">
      <div className="auth-card auth-card--register">
        <div className="auth-brand-mark" aria-hidden="true">📚</div>
        <p className="eyebrow">CREATE YOUR LIBRARY ACCOUNT</p>
        <h2>Register as a member</h2>
        <p className="auth-subtitle">Create your account first. Once registered, use your member ID or email to sign in.</p>

        <form className="login-form register-form" onSubmit={handleSubmit} noValidate>
          <Input label="Full name" name="name" value={form.name} onChange={handleChange} placeholder="Your full name" autoComplete="name" required error={errors.name} />
          <Input label="Member ID" name="memberId" value={form.memberId} onChange={handleChange} placeholder="For example, LIB2026001" autoComplete="username" required error={errors.memberId} hint="Use 2–10 letters followed by at least 4 letters, numbers, or hyphens." />
          <Input label="Email address" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" required error={errors.email} />
          <Input label="Phone number" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="10–15 digits" autoComplete="tel" required error={errors.phone} />
          <Input label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Create a password" autoComplete="new-password" required error={errors.password} hint="At least 8 characters, including one letter and one number." />
          <Input label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Enter the password again" autoComplete="new-password" required error={errors.confirmPassword} />
          {errors.form && <p className="error-message" role="alert">{errors.form}</p>}
          <Button type="submit" className="auth-submit" loading={submitting}>Create account →</Button>
        </form>

        <p className="auth-switch">Already registered? <Link to="/login" state={location.state}>Sign in</Link></p>
        <p className="demo-disclaimer"><strong>Academic demo:</strong> account details are registered with the local library API. Passwords are hashed on the server; this classroom API is not intended for public production deployment.</p>
        <p className="auth-back-link"><Link to="/">← Back to the library</Link></p>
      </div>
    </section>
  );
};

export default Register;
