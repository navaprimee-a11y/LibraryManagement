import React from 'react';

const Button = ({ children, type = 'button', variant = 'primary', className = '', loading = false, disabled = false, ...props }) => (
  <button
    type={type}
    className={`ui-button ui-button--${variant} ${className}`.trim()}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading ? <><span className="button-spinner" aria-hidden="true" /> Processing…</> : children}
  </button>
);

export default Button;
