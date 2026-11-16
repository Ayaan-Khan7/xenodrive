import mongoose from "mongoose";

const fileVersionSchema = new mongoose.Schema(
  {
    file_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: true,
      index: true,
    },
    version_number: {
      type: Number,
      required: true,
      min: 1,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    storage_key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    mime_type: {
      type: String,
      required: true,
      default: "application/octet-stream",
    },
    checksum_sha256: {
      type: String,
      default: null,
    },
    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    change_summary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 250,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.file_id = ret.file_id ? ret.file_id.toString() : null;
        ret.uploaded_by = ret.uploaded_by ? ret.uploaded_by.toString() : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for querying versions of a file
fileVersionSchema.index({ file_id: 1, version_number: -1 });

const FileVersion = mongoose.model("FileVersion", fileVersionSchema);

export default FileVersion;
