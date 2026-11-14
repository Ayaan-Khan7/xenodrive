const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validator for User Registration
 */
export const validateRegister = (req) => {
  const errors = [];
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push({
      field: "name",
      message: "Full name is required and must be at least 2 characters.",
    });
  } else if (name.trim().length > 50) {
    errors.push({
      field: "name",
      message: "Full name cannot exceed 50 characters.",
    });
  }

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    errors.push({
      field: "email",
      message: "A valid email address is required.",
    });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push({
      field: "password",
      message: "Password is required and must be at least 6 characters.",
    });
  }

  return errors.length > 0 ? errors : null;
};

/**
 * Validator for User Login
 */
export const validateLogin = (req) => {
  const errors = [];
  const { email, password } = req.body || {};

  if (!email || typeof email !== "string" || !email.trim()) {
    errors.push({
      field: "email",
      message: "Email address is required.",
    });
  }

  if (!password || typeof password !== "string" || !password) {
    errors.push({
      field: "password",
      message: "Password is required.",
    });
  }

  return errors.length > 0 ? errors : null;
};

/**
 * Validator for Forgot Password
 */
export const validateForgotPassword = (req) => {
  const errors = [];
  const { email } = req.body || {};

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    errors.push({
      field: "email",
      message: "A valid email address is required.",
    });
  }

  return errors.length > 0 ? errors : null;
};

/**
 * Validator for Password Reset
 */
export const validateResetPassword = (req) => {
  const errors = [];
  const { password } = req.body || {};

  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push({
      field: "password",
      message: "New password is required and must be at least 6 characters.",
    });
  }

  return errors.length > 0 ? errors : null;
};

