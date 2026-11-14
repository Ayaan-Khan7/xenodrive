import { Router } from "express";
import { checkHealth } from "../controllers/healthController.js";
import { validate } from "../middleware/validate.js";
import { validateHealthQuery } from "../validators/healthValidator.js";

const router = Router();

// GET /api/health (supports ?verbose=true)
router.get("/", validate(validateHealthQuery), checkHealth);

export default router;

