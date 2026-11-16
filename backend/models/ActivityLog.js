import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "upload",
        "download",
        "delete",
        "permanent_delete",
        "create_folder",
        "share_create",
        "share_revoke",
        "restore",
        "version_upload",
        "version_restore",
        "rename",
        "move",
      ],
      index: true,
    },
    resource_type: {
      type: String,
      required: true,
      enum: ["file", "folder", "share"],
    },
    resource_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    resource_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.user_id = ret.user_id ? ret.user_id.toString() : null;
        ret.resource_id = ret.resource_id ? ret.resource_id.toString() : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for user activity queries sorted by time
activityLogSchema.index({ user_id: 1, created_at: -1 });
activityLogSchema.index({ user_id: 1, action: 1, created_at: -1 });

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;
