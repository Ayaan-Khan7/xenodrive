import { Router } from "express";
import {
  getShares,
  createShare,
  revokeShare,
  accessSharedResource,
  downloadSharedResource,
} from "../controllers/shareController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Public routes for shared link recipients
router.get("/access/:token", accessSharedResource);
router.post("/access/:token", accessSharedResource);
router.get("/access/:token/download", downloadSharedResource);
router.post("/access/:token/download", downloadSharedResource);

// Protected routes for managing user's share links
router.use(protect);
router.get("/", getShares);
router.post("/", createShare);
router.delete("/:id", revokeShare);

export default router;

