import { AppError } from "../utils/appError.js";

/**
 * Reusable validation middleware
 * Executes a validation function against the request (body, query, params)
 *
 * @param {Function} validatorFn - (req) => Array<{ field: string, message: string }> | null
 * @returns {import('express').RequestHandler}
 */
export const validate = (validatorFn) => {
  return (req, res, next) => {
    try {
      const errors = validatorFn(req);

      if (errors && Array.isArray(errors) && errors.length > 0) {
        return next(new AppError("Validation failed", 400, errors));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

