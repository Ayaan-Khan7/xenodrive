import crypto from "crypto";
import User from "../models/User.js";
import { sendTokenResponse } from "../utils/jwt.js";
import { AppError } from "../utils/appError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return next(new AppError("An account with this email address already exists.", 409));
  }

  // Create user
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    storage_used: 0,
    storage_limit: 1073741824, // 1 GB
  });

  logger.info(`New user registered: ${user.email} (${user._id})`);

  return sendTokenResponse(user, 201, res, "Registration successful");
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || "").toLowerCase().trim();

  // Find user and explicitly select password field
  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Invalid email or password", 401));
  }

  logger.info(`User logged in: ${user.email} (${user._id})`);

  return sendTokenResponse(user, 200, res, "Logged in successfully");
});

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = req.user.toJSON();
  return res.status(200).json({
    success: true,
    message: "User profile retrieved successfully",
    user,
    data: { user },
  });
});

/**
 * @desc    Logout user & clear cookie
 * @route   POST /api/auth/logout
 * @access  Public / Private
 */
export const logout = asyncHandler(async (req, res) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
  });

  return ApiResponse.success(res, { message: "Logged out successfully" }, "Logged out successfully");
});

/**
 * @desc    Forgot password - generate reset token
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const normalizedEmail = (email || "").toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    // For security reasons, do not leak whether the email exists
    return ApiResponse.success(
      res,
      { message: "If this email is registered, password reset instructions have been generated." },
      "Password reset request received"
    );
  }

  // Generate reset token
  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  logger.info(`Password reset token generated for ${user.email}: ${resetToken}`);

  // In production, an email would be dispatched with this token
  const resetUrl = `${env.CLIENT_URL.split(",")[0]}/reset-password/${resetToken}`;

  return ApiResponse.success(
    res,
    {
      message: "Password reset token generated successfully.",
      resetToken, // Provided for API consumption and testing
      resetUrl,
    },
    "Password reset instructions generated"
  );
});

/**
 * @desc    Reset password using valid reset token
 * @route   POST /api/auth/reset-password/:resetToken
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res, next) => {
  const { resetToken } = req.params;
  const { password } = req.body;

  // Hash incoming token to match stored hash
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Find user with matching token and valid expiration
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("Password reset token is invalid or has expired.", 400));
  }

  // Set new password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  logger.info(`Password successfully reset for user: ${user.email} (${user._id})`);

  return sendTokenResponse(user, 200, res, "Password reset successfully. You are now logged in.");
});
