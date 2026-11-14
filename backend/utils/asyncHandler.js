/**
 * Wraps an async route handler to catch rejected promises and forward them to next()
 * @param {Function} fn
 * @returns {import('express').RequestHandler}
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

