import mongoose from 'mongoose';

const AppointmentEventSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true, default: Date.now },
    type: { 
      type: String, 
      enum: ['video_play', 'pdf_open', 'product_open', 'start', 'stop', 'other'], 
      required: true 
    },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const AppointmentSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    date: { type: String, required: true },
    notes: String,
    events: { type: [AppointmentEventSchema], default: [] },
    startedAt: Date,
    endedAt: Date,
    durationSeconds: Number,
  },
  { timestamps: true }
);

export default mongoose.models.Appointment || mongoose.model('Appointment', AppointmentSchema);
