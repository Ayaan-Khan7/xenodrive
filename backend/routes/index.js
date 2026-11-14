import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import authRoutes from "./authRoutes.js";
import folderRoutes from "./folderRoutes.js";
import fileRoutes from "./fileRoutes.js";
import trashRoutes from "./trashRoutes.js";
import shareRoutes from "./shareRoutes.js";

const apiRouter = Router();

// Mount Health Check Routes
apiRouter.use("/health", healthRoutes);

// Mount Authentication Routes
apiRouter.use("/auth", authRoutes);

// Mount Folder Management Routes
apiRouter.use("/folders", folderRoutes);

// Mount Cloudflare R2 File Storage Routes
apiRouter.use("/files", fileRoutes);

// Mount Trash Management Routes
apiRouter.use("/trash", trashRoutes);

// Mount Resource Sharing Routes
apiRouter.use("/shares", shareRoutes);

export default apiRouter;
