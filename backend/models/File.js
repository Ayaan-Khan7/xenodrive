import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
      maxlength: [255, "File name cannot exceed 255 characters"],
    },
    original_name: {
      type: String,
      required: true,
    },
    mime_type: {
      type: String,
      required: true,
      default: "application/octet-stream",
    },
    size: {
      type: Number,
      required: [true, "File size in bytes is required"],
      min: [0, "File size cannot be negative"],
    },
    storage_key: {
      type: String,
      required: [true, "Storage key is required"],
      index: true,
    },
    checksum_sha256: {
      type: String,
      index: true,
      default: null,
    },
    folder_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    is_trashed: {
      type: Boolean,
      default: false,
      index: true,
    },
    trashed_at: {
      type: Date,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    extracted_text: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.folder_id = ret.folder_id ? ret.folder_id.toString() : null;
        ret.owner_id = ret.owner_id ? ret.owner_id.toString() : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for fast queries: owner + folder + trash status
fileSchema.index({ owner_id: 1, folder_id: 1, is_trashed: 1 });
// Compound index for duplicate detection: owner + checksum + is_trashed
fileSchema.index({ owner_id: 1, checksum_sha256: 1, is_trashed: 1 });
// Compound index for largest files query: owner + is_trashed + size
fileSchema.index({ owner_id: 1, is_trashed: 1, size: -1 });
// Compound text index for document search
fileSchema.index({ name: "text", extracted_text: "text" });

const File = mongoose.model("File", fileSchema);

export default File;

