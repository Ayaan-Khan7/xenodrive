import fs from "fs";
import path from "path";
import { Router } from "express";
import {
  requestUploadUrl,
  confirmUpload,
  getFiles,
  getDuplicateFiles,
  getPreviewUrl,
  renameFile,
  moveFile,
  trashFile,
  restoreFile,
  permanentDeleteFile,
} from "../controllers/fileController.js";
import {
  requestVersionUploadUrl,
  confirmVersionUpload,
  getFileVersions,
  restoreFileVersion,
  deleteFileVersion,
  downloadFileVersion,
} from "../controllers/versionController.js";
import { getLocalFilePath } from "../services/r2StorageService.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  validateRequestUploadUrl,
  validateConfirmUpload,
  validateRename,
  validateMove,
} from "../validators/fileValidator.js";

const router = Router();

// ============================================================================
// Public endpoints for local storage direct upload & streaming fallback
// (Simulates S3/R2 direct presigned URLs when R2 credentials are not set)
// ============================================================================
router.put("/storage/upload", (req, res, next) => {
  try {
    const key = req.query.key;
    if (!key) return res.status(400).send("Missing storage key");

    const filePath = getLocalFilePath(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);

    writeStream.on("finish", () => {
      res.status(200).send("Upload complete");
    });

    writeStream.on("error", (err) => {
      res.status(500).send(err.message);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/storage/content", (req, res, next) => {
  try {
    const { key, name, download } = req.query;
    if (!key) return res.status(400).send("Missing storage key");

    const filePath = getLocalFilePath(key);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found");
    }

    const stat = fs.statSync(filePath);
    const disposition = download === "true" ? "attachment" : "inline";

    if (name) {
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${encodeURIComponent(name)}"`
      );
    }
    res.setHeader("Content-Length", stat.size);

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Protected API Routes (User authentication required)
// ============================================================================
router.use(protect);

// Presigned Direct Upload Flow
router.post("/request-upload-url", validate(validateRequestUploadUrl), requestUploadUrl);
router.post("/confirm-upload", validate(validateConfirmUpload), confirmUpload);

// File CRUD & Operations
router.get("/", getFiles);
router.get("/duplicates", getDuplicateFiles);
router.get("/:id/preview", getPreviewUrl);
router.patch("/:id/rename", validate(validateRename), renameFile);
router.patch("/:id/move", validate(validateMove), moveFile);
router.delete("/:id", trashFile);
router.post("/:id/restore", restoreFile);
router.patch("/:id/restore", restoreFile);
router.delete("/:id/permanent", permanentDeleteFile);

// File Version History Flow
router.post("/:id/versions/request-upload-url", requestVersionUploadUrl);
router.post("/:id/versions/confirm-upload", confirmVersionUpload);
router.get("/:id/versions", getFileVersions);
router.post("/:id/versions/:versionId/restore", restoreFileVersion);
router.delete("/:id/versions/:versionId", deleteFileVersion);
router.get("/:id/versions/:versionId/download", downloadFileVersion);

export default router;
