import mongoose from "mongoose";

const ActivityEntrySchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    eventType: { type: String, enum: ["login", "activity"], default: "activity" },
    action: { type: String, default: "unknown_action" },
    deckTitle: { type: String, default: null },
    screen: { type: String, default: null },
    timestampMs: { type: Number, default: null },
    occurredAt: { type: Date, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const ActivityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    method: { type: String, enum: ["password", "keygen"], required: true },
    source: { type: String, enum: ["online", "offline"], required: true },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, required: true },
    lastOccurredAt: { type: Date, required: true, index: true },
    eventCount: { type: Number, default: 0 },
    events: { type: [ActivityEntrySchema], default: [] },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
ActivityLogSchema.index({ lastOccurredAt: -1 });

export default mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", ActivityLogSchema);
