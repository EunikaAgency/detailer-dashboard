import mongoose from 'mongoose';

const DoctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    specialty: { type: String, required: true },
    preferences: { type: String, required: false },
  },
  { timestamps: true }
);

export default mongoose.models.Doctor || mongoose.model('Doctor', DoctorSchema);
