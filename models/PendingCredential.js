import mongoose from "mongoose";

const PendingCredentialSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, lowercase: true, unique: true },
    name: { type: String, trim: true, default: "" },
    repId: { type: String, trim: true, default: "" },
    role: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    credentialHash: { type: String, required: true, trim: true },
    credentialIssuedAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.PendingCredential ||
  mongoose.model("PendingCredential", PendingCredentialSchema);
