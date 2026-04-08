import mongoose from "mongoose";

const SlideRetentionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    retentionId: { type: String, required: true },
    sessionId: { type: String, default: null, index: true },
    method: { type: String, enum: ["password", "keygen", null], default: null },
    source: { type: String, enum: ["online", "offline", null], default: null },
    presentationId: { type: String, required: true, index: true },
    caseId: { type: String, required: true, index: true },
    deckId: { type: String, default: null, index: true },
    presentationTitle: { type: String, default: null },
    deckTitle: { type: String, default: null },
    slideId: { type: String, default: null },
    slideIndex: { type: Number, required: true, min: 0, index: true },
    slideNumber: { type: Number, required: true, min: 1 },
    slideTitle: { type: String, default: null },
    slideType: { type: String, default: null },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, required: true, index: true },
    durationMs: { type: Number, required: true, min: 0 },
    durationSeconds: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 0 },
    userAgent: { type: String, default: null },
    browser: { type: String, default: null },
    browserName: { type: String, default: null },
    browserVersion: { type: String, default: null },
    platform: { type: String, default: null },
    os: { type: String, default: null },
    device: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

SlideRetentionSchema.index({ userId: 1, retentionId: 1 }, { unique: true });
SlideRetentionSchema.index({ userId: 1, presentationId: 1, caseId: 1, slideIndex: 1, endedAt: -1 });

export default mongoose.models.SlideRetention ||
  mongoose.model("SlideRetention", SlideRetentionSchema);
