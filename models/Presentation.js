import mongoose from 'mongoose';

const PresentationSlideSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    url: { type: String, required: true },
    title: String,
  },
  { _id: false }
);

const PresentationSchema = new mongoose.Schema(
  {
    deckId: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    originalFileUrl: { type: String, required: true },
    slideCount: { type: Number, required: true },
    slides: { type: [PresentationSlideSchema], default: [] },
    videoUrl: String,
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    error: String,
  },
  { timestamps: true }
);

export default mongoose.models.Presentation || mongoose.model('Presentation', PresentationSchema);
