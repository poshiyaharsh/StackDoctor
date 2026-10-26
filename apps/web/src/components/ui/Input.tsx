import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  id,
  className = "",
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="form-group">
      {label ? (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      ) : null}
      <input id={inputId} className={`form-input ${className}`} {...props} />
      {error ? <p className="form-error">{error}</p> : null}
      {helperText && !error ? <p className="form-help">{helperText}</p> : null}
    </div>
  );
}
