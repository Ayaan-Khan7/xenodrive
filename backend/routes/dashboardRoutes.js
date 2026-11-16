import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Protect dashboard route
router.use(protect);

router.get("/stats", getDashboardStats);

export default router;
