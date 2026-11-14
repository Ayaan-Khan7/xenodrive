import mongoose from "mongoose";

const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Folder name is required"],
      trim: true,
      maxlength: [100, "Folder name cannot exceed 100 characters"],
    },
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    path: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
      },
    ],
    is_trashed: {
      type: Boolean,
      default: false,
      index: true,
    },
    trashed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.parent_id = ret.parent_id ? ret.parent_id.toString() : null;
        ret.owner_id = ret.owner_id ? ret.owner_id.toString() : null;
        ret.path = (ret.path || []).map((p) => p.toString());
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for fast queries: owner + parent + trash status
folderSchema.index({ owner_id: 1, parent_id: 1, is_trashed: 1 });

const Folder = mongoose.model("Folder", folderSchema);

export default Folder;

