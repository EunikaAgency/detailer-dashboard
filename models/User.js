import mongoose from 'mongoose';
import { REPORT_DIVISION_VALUES } from "@/lib/reportDivision";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    repId: { type: String, trim: true, default: "" },
    role: { type: String, trim: true, default: "" },
    division: {
      type: String,
      trim: true,
      enum: ["", ...REPORT_DIVISION_VALUES],
      default: "",
    },
    accessType: {
      type: String,
      trim: true,
      enum: ["", "admin", "representative"],
      default: "",
    },
    password: { type: String, required: true },
    keygen: { type: String, default: "" },
    keygenIssuedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', UserSchema);
