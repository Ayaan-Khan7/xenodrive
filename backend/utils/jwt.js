import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * Generate a signed JWT token for a user
 * @param {string} userId
 * @returns {string}
 */
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

/**
 * Verify a JWT token
 * @param {string} token
 * @returns {Object} decoded token payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

/**
 * Send JWT token in an HTTP-only cookie and JSON response
 * @param {Object} user - User document
 * @param {number} statusCode - HTTP status code
 * @param {import('express').Response} res - Express response object
 * @param {string} [message="Success"] - Optional success message
 */
export const sendTokenResponse = (user, statusCode, res, message = "Success") => {
  const token = generateToken(user._id || user.id);

  // Cookie expiration (7 days by default)
  const cookieExpiresDays = 7;
  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpiresDays * 24 * 60 * 60 * 1000),
    httpOnly: true, // Prevent client-side JS from reading cookie
    secure: env.isProduction, // HTTPS only in production
    sameSite: env.isProduction ? "none" : "lax", // Supports cross-site in production if frontend/backend are on different domains
  };

  // Set HTTP-only cookie
  res.cookie("token", token, cookieOptions);

  const userJson = user.toJSON ? user.toJSON() : {
    id: (user._id || user.id).toString(),
    name: user.name,
    email: user.email,
    storage_used: user.storage_used,
    storage_limit: user.storage_limit,
    created_at: user.created_at,
  };

  return res.status(statusCode).json({
    success: true,
    message,
    token,
    user: userJson,
  });
};

