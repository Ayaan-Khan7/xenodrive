import mongoose from "mongoose";

const shareSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    resource_type: {
      type: String,
      enum: ["file", "folder"],
      required: true,
    },
    resource_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    permission: {
      type: String,
      enum: ["view", "download"],
      default: "download",
    },
    password_hash: {
      type: String,
      default: null,
    },
    is_password_protected: {
      type: Boolean,
      default: false,
    },
    expires_at: {
      type: Date,
      default: null,
    },
    access_count: {
      type: Number,
      default: 0,
    },
    download_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.resource_id = ret.resource_id.toString();
        ret.owner_id = ret.owner_id.toString();
        ret.has_password = Boolean(ret.password_hash || ret.is_password_protected);
        ret.is_password_protected = Boolean(ret.password_hash || ret.is_password_protected);
        delete ret.password_hash;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Share = mongoose.model("Share", shareSchema);

export default Share;

