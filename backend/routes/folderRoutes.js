import { Router } from "express";
import {
  getFolders,
  getFolderById,
  createFolder,
  renameFolder,
  moveFolder,
  trashFolder,
  restoreFolder,
  permanentDeleteFolder,
} from "../controllers/folderController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Protect all folder routes
router.use(protect);

router.get("/", getFolders);
router.get("/:id", getFolderById);
router.post("/", createFolder);
router.patch("/:id/rename", renameFolder);
router.patch("/:id/move", moveFolder);
router.delete("/:id", trashFolder);
router.post("/:id/restore", restoreFolder);
router.patch("/:id/restore", restoreFolder);
router.delete("/:id/permanent", permanentDeleteFolder);

export default router;

