import { Router } from "express";
import {
  requestUploadUrl,
  confirmUpload,
  getFiles,
  getPreviewUrl,
  renameFile,
  moveFile,
  trashFile,
  restoreFile,
  permanentDeleteFile,
} from "../controllers/fileController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  validateRequestUploadUrl,
  validateConfirmUpload,
  validateRename,
  validateMove,
} from "../validators/fileValidator.js";

const router = Router();

// All file routes are protected
router.use(protect);

// Presigned R2 Direct Upload Flow
router.post("/request-upload-url", validate(validateRequestUploadUrl), requestUploadUrl);
router.post("/confirm-upload", validate(validateConfirmUpload), confirmUpload);

// File CRUD & Operations
router.get("/", getFiles);
router.get("/:id/preview", getPreviewUrl);
router.patch("/:id/rename", validate(validateRename), renameFile);
router.patch("/:id/move", validate(validateMove), moveFile);
router.delete("/:id", trashFile);
router.post("/:id/restore", restoreFile);
router.patch("/:id/restore", restoreFile);
router.delete("/:id/permanent", permanentDeleteFile);

export default router;

