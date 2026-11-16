import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import authRoutes from "./authRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import folderRoutes from "./folderRoutes.js";
import fileRoutes from "./fileRoutes.js";
import trashRoutes from "./trashRoutes.js";
import shareRoutes from "./shareRoutes.js";
import activityRoutes from "./activityRoutes.js";

const apiRouter = Router();

// Mount Health Check Routes
apiRouter.use("/health", healthRoutes);

// Mount Authentication Routes
apiRouter.use("/auth", authRoutes);

// Mount Dashboard Analytics Routes
apiRouter.use("/dashboard", dashboardRoutes);

// Mount Folder Management Routes
apiRouter.use("/folders", folderRoutes);

// Mount Cloudflare R2 File Storage Routes
apiRouter.use("/files", fileRoutes);

// Mount Trash Management Routes
apiRouter.use("/trash", trashRoutes);

// Mount Resource Sharing Routes
apiRouter.use("/shares", shareRoutes);

// Mount Activity Logs Routes
apiRouter.use("/activity", activityRoutes);

export default apiRouter;
