import { Router } from "express";
import {
  getShares,
  createShare,
  revokeShare,
  accessSharedResource,
} from "../controllers/shareController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Public route for shared link recipients
router.get("/access/:token", accessSharedResource);

// Protected routes for managing user's share links
router.use(protect);
router.get("/", getShares);
router.post("/", createShare);
router.delete("/:id", revokeShare);

export default router;

