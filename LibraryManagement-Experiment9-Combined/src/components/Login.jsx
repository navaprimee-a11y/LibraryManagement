import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateLogin } from '../utils/validation';
import Button from './common/Button';
import Input from './common/Input';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({ identifier: location.state?.identifier || '', password: '' }));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { login, isAuthenticated, authError, clearAuthError } = useAuth();

  const requestedPath = location.state?.from;
  const redirectTo = typeof requestedPath === 'string' && requestedPath.startsWith('/') && !requestedPath.startsWith('//')
    ? requestedPath
    : '/';

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: '', form: '' }));
    clearAuthError();
  };

  useEffect(() => {
    if (location.state?.identifier) {
      setForm((current) => ({ ...current, identifier: location.state.identifier }));
    }
  }, [location.state?.identifier]);

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateLogin(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    const result = await login(form);
    setSubmitting(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  return (
    <section className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand-mark" aria-hidden="true">📚</div>
        <p className="eyebrow">MEMBER ACCESS</p>
        <h2>Welcome back</h2>
        <p className="auth-subtitle">Sign in to manage loans, renew books, and view your reading history.</p>
        {location.state?.registered && <p className="notice" role="status">Registration successful! Your account has been created. Sign in using your registered member ID or email and password.</p>}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Member ID or email"
            name="identifier"
            type="text"
            value={form.identifier}
            onChange={handleChange}
            placeholder="LIB2024001 or member@example.com"
            autoComplete="username"
            required
            error={errors.identifier}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            autoComplete="current-password"
            required
            error={errors.password}
            hint="Enter the password you created during registration."
          />
          {errors.form && <p className="error-message" role="alert">{errors.form}</p>}
          {authError && authError !== errors.form && <p className="error-message" role="alert">{authError}</p>}
          <Button type="submit" className="auth-submit" loading={submitting}>Sign in →</Button>
        </form>
        <p className="auth-switch">New to the library? <Link to="/register" state={location.state}>Create an account</Link></p>
        <p className="demo-disclaimer"><strong>Academic demo:</strong> sign-in is verified by the library authentication API. A bearer token is stored in browser storage and expires automatically.</p>
        <p className="auth-back-link"><Link to="/">← Back to the library</Link></p>
      </div>
    </section>
  );
};

export default Login;
