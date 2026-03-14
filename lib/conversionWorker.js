import path from "path";
import { promises as fs } from "fs";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { convertFileToImages } from "@/lib/fileConverter";

const WORKER_INTERVAL_MS = Number(process.env.CONVERSION_WORKER_INTERVAL_MS || "60000");
const QUEUE_DIR = path.join(process.cwd(), "public", "uploads", "queue");

const getQueueFile = async () => {
  try {
    const entries = await fs.readdir(QUEUE_DIR);
    const files = entries.filter((name) => !name.startsWith("."));
    if (!files.length) return null;
    return files[0];
  } catch {
    return null;
  }
};

const findProductForQueueFile = async (filename) => {
  await connectDB();
  const url = `/uploads/queue/${filename}`;
  const product = await Product.findOne({ "media.url": url }).lean();
  if (!product) return null;
  const pending = (product.media || []).find((item) => item?.url === url) || null;
  if (!pending) return null;
  return { product, pending };
};

const toImages = async (pending, filename) => {
  const filePath = path.join(QUEUE_DIR, filename);
  const buffer = await fs.readFile(filePath);
  const targetFolder = pending.groupId || filename.replace(path.extname(filename), "");
  return convertFileToImages(buffer, filename, "", targetFolder);
};

export const processOne = async () => {
  const filename = await getQueueFile();
  if (!filename) return { status: "empty" };

  const pendingEntry = await findProductForQueueFile(filename);
  if (!pendingEntry) {
    return { status: "orphan", filename };
  }
  const { product, pending } = pendingEntry;

  try {
    console.log("Async conversion: processing", {
      productId: String(product._id || ""),
      url: pending.url,
      groupId: pending.groupId,
      sourceName: pending.sourceName,
    });
    const result = await toImages(pending, filename);
    if (!result.converted || !result.images?.length) {
      return { status: "no-images" };
    }

    const nextMedia = (product.media || [])
      .filter((item) => item.url !== pending.url)
      .concat(
        result.images.map((url) => ({
          type: "image",
          url,
          groupId: pending.groupId || result.folderName,
          groupTitle: pending.groupTitle,
          sourceName: pending.sourceName || pending.originalName || pending.groupId || "",
        }))
      );

    await Product.updateOne({ _id: product._id }, { $set: { media: nextMedia } });

    try {
      await fs.unlink(path.join(QUEUE_DIR, filename));
    } catch {
      // ignore cleanup errors
    }
    return { status: "converted", images: result.images.length };
  } catch (error) {
    console.error("Async conversion error:", error);
    return { status: "error", error: error?.message || "unknown" };
  }
};

if (!global.__conversionWorkerStarted) {
  global.__conversionWorkerStarted = true;
  setInterval(() => {
    processOne().catch((error) => {
      console.error("Async conversion tick failed:", error);
    });
  }, WORKER_INTERVAL_MS);
}
