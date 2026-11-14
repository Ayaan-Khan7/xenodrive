import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

/**
 * MongoDB connection states mapping
 */
const CONNECTION_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * Connect to MongoDB Atlas / Local MongoDB
 */
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
    });

    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error("MongoDB initial connection error:", {
      message: error.message,
      uri: env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@"), // Mask credentials in logs
    });
    // Do not crash the server on initial connection failure; allow retry/health monitoring
    return null;
  }
};

// Event listeners for connection monitoring
mongoose.connection.on("connected", () => {
  logger.info("Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  logger.error("Mongoose connection error:", { message: err.message });
});

mongoose.connection.on("disconnected", () => {
  logger.warn("Mongoose disconnected from MongoDB");
});

/**
 * Returns current MongoDB connection diagnostic status
 */
export const getDbStatus = () => {
  const readyState = mongoose.connection.readyState;
  return {
    state: CONNECTION_STATES[readyState] || "unknown",
    isConnected: readyState === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
};

/**
 * Graceful database disconnect
 */
export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed through app termination");
  } catch (error) {
    logger.error("Error closing MongoDB connection:", { message: error.message });
  }
};

