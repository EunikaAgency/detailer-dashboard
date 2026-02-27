import mongoose from "mongoose";

const LoginEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eventType: { type: String, enum: ["login", "activity"], default: "login", index: true },
    method: { type: String, enum: ["password", "keygen"], required: true },
    source: { type: String, enum: ["online", "offline"], required: true },
    action: { type: String, default: "login_success" },
    screen: { type: String, default: null },
    sessionId: { type: String, default: null, index: true },
    timestampMs: { type: Number, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: true }
);

LoginEventSchema.index({ userId: 1, occurredAt: -1 });

export default mongoose.models.LoginEvent ||
  mongoose.model("LoginEvent", LoginEventSchema);
