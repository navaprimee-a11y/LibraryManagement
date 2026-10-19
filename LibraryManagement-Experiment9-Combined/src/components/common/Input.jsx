import React, { useId } from 'react';

const Input = ({ label, error, hint, id, as = 'input', options = [], className = '', ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = [error ? `${inputId}-error` : '', hint ? `${inputId}-hint` : ''].filter(Boolean).join(' ') || undefined;
  const shared = {
    id: inputId,
    className: `ui-input ${error ? 'ui-input--invalid' : ''} ${className}`.trim(),
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
    ...props,
  };
  return (
    <div className="ui-field">
      {label && <label className="ui-label" htmlFor={inputId}>{label}{props.required && <span aria-hidden="true"> *</span>}</label>}
      {as === 'select' ? <select {...shared}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        : as === 'textarea' ? <textarea {...shared} />
          : <input {...shared} />}
      {hint && <small className="ui-hint" id={`${inputId}-hint`}>{hint}</small>}
      {error && <small className="ui-error" id={`${inputId}-error`} role="alert">{error}</small>}
    </div>
  );
};

export default Input;
