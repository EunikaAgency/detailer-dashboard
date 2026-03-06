import mongoose from "mongoose";

const AppSettingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, default: "global" },
    apiLoginRequired: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.AppSetting || mongoose.model("AppSetting", AppSettingSchema);
