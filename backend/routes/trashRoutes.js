import { Router } from "express";
import { getTrash, emptyTrash } from "../controllers/trashController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Protect all trash routes
router.use(protect);

router.get("/", getTrash);
router.post("/empty", emptyTrash);
router.delete("/empty", emptyTrash);

export default router;

