export const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

// Accept a library code such as LIB2024001 (letters followed by an alphanumeric code).
export const isValidMemberId = (value = '') => /^[A-Za-z]{2,10}[A-Za-z0-9-]{4,19}$/.test(value.trim());

// Accept common local and international formats, with 10–15 digits after punctuation is removed.
export const isValidPhone = (value = '') => {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

export const validateLogin = ({ identifier = '', password = '' }) => {
  const errors = {};
  const value = identifier.trim();
  if (!value) errors.identifier = 'Enter your member ID or email address.';
  else if (value.includes('@') ? !isValidEmail(value) : !isValidMemberId(value)) {
    errors.identifier = 'Enter a valid email address or member ID (for example, LIB2024001).';
  }
  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Use at least 8 characters, including one letter and one number.';
  }
  return errors;
};

export const validateBorrowRequest = ({ memberId = '', email = '', phone = '' }) => {
  const errors = {};
  if (!memberId.trim()) errors.memberId = 'Member ID is required.';
  else if (!isValidMemberId(memberId)) errors.memberId = 'Enter a valid member ID (for example, LIB2024001).';
  if (!email.trim()) errors.email = 'Email address is required.';
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  if (!phone.trim()) errors.phone = 'Phone number is required.';
  else if (!isValidPhone(phone)) errors.phone = 'Enter a phone number with 10–15 digits.';
  return errors;
};

export const validateProfile = ({ name = '', memberId = '', email = '', phone = '', membershipType = '' }) => {
  const errors = {};
  if (!name.trim()) errors.name = 'Full name is required.';
  else if (name.trim().length < 2) errors.name = 'Enter at least 2 characters.';
  if (!membershipType.trim()) errors.membershipType = 'Membership type is required.';
  if (!memberId.trim()) errors.memberId = 'Member ID is required.';
  else if (!isValidMemberId(memberId)) errors.memberId = 'Enter a valid member ID (for example, LIB2024001).';
  if (!email.trim()) errors.email = 'Email address is required.';
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  if (!phone.trim()) errors.phone = 'Phone number is required.';
  else if (!isValidPhone(phone)) errors.phone = 'Enter a phone number with 10–15 digits.';
  return errors;
};

export const validateRenewalRequest = ({ reason = '', email = '', phone = '' }) => {
  const errors = {};
  if (!reason.trim()) errors.reason = 'A reason for renewal is required.';
  else if (reason.trim().length < 10) errors.reason = 'Please provide at least 10 characters.';
  if (!email.trim()) errors.email = 'Email address is required.';
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  if (!phone.trim()) errors.phone = 'Phone number is required.';
  else if (!isValidPhone(phone)) errors.phone = 'Enter a phone number with 10–15 digits.';
  return errors;
};

export const validateRegister = ({ name = '', memberId = '', email = '', phone = '', password = '', confirmPassword = '' }) => {
  const errors = {};
  if (!name.trim()) errors.name = 'Full name is required.';
  else if (name.trim().length < 2) errors.name = 'Enter at least 2 characters.';
  if (!memberId.trim()) errors.memberId = 'Member ID is required.';
  else if (!isValidMemberId(memberId)) errors.memberId = 'Use a valid member ID, such as LIB2026001.';
  if (!email.trim()) errors.email = 'Email address is required.';
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  if (!phone.trim()) errors.phone = 'Phone number is required.';
  else if (!isValidPhone(phone)) errors.phone = 'Enter a phone number with 10–15 digits.';
  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Use at least 8 characters, including one letter and one number.';
  }
  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
};
