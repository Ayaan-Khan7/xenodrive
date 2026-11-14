import { Router } from "express";
import {
  register,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} from "../validators/authValidator.js";

const router = Router();

// Public auth routes with strict rate limiting
router.post("/register", strictLimiter, validate(validateRegister), register);
router.post("/login", strictLimiter, validate(validateLogin), login);
router.post("/logout", logout);
router.post("/forgot-password", strictLimiter, validate(validateForgotPassword), forgotPassword);
router.post("/reset-password/:resetToken", strictLimiter, validate(validateResetPassword), resetPassword);

// Protected user route
router.get("/me", protect, getMe);

export default router;

