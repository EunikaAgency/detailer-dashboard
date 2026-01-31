import mongoose from 'mongoose';

const MediaSchema = new mongoose.Schema({
  type: { type: String, enum: ['video', 'pdf', 'image'], required: true },
  url: { type: String, required: true },
  title: String,
  size: Number,
}, { _id: false });

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brandName: String,
    description: { type: String, required: true },
    category: { type: String, required: true },
    media: { type: [MediaSchema], default: [] },
    thumbnailUrl: String,
  },
  { timestamps: true }
);

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
