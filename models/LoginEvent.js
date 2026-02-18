import mongoose from "mongoose";

const LoginEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    method: { type: String, enum: ["password", "keygen"], required: true },
    source: { type: String, enum: ["online", "offline"], required: true },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.LoginEvent ||
  mongoose.model("LoginEvent", LoginEventSchema);
