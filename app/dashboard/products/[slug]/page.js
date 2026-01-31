"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";

const toSlug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const FALLBACK_IMAGE = "/images/product-fallback.svg";

const mapProduct = (product) => {
  const image =
    product.thumbnailUrl ||
    product.media?.[0]?.url ||
    FALLBACK_IMAGE;

  return {
    id: product._id?.toString?.() || product._id || product.id || "",
    slug: toSlug(product.name),
    name: product.name,
    brand: product.brandName || "",
    category: product.category,
    description: product.description,
    image,
    thumbnailUrl: product.thumbnailUrl || "",
    media: (product.media || []).map((item) => ({
      url: item.url,
      type: item.type,
      title: item.title,
      size: item.size,
    })),
  };
};

const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  const tone =
    toast.type === "success"
      ? "bg-green-600"
      : toast.type === "error"
      ? "bg-red-600"
      : "bg-blue-600";
  return (
    <div className="fixed top-6 right-6 z-50">
      <div className={`${tone} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white"
        >
          x
        </button>
      </div>
    </div>
  );
};

export default function ProductDetailPage() {
  const router = useRouter();
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [existingMedia, setExistingMedia] = useState([]);
  const [toast, setToast] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "video/*": [],
    },
    onDrop: (acceptedFiles) => {
      setMediaFiles(acceptedFiles || []);
    },
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const isValidUrl = (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const refreshProduct = async () => {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data)) return;
      const mapped = data.map(mapProduct);
      const found = mapped.find((item) => item.slug === slug) || null;
      if (found) {
        setProduct(found);
        setExistingMedia(found.media || []);
      }
    } catch (error) {
      console.error("Refresh product error:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadProducts = async () => {
      try {
        const response = await fetch("/api/products");
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data)) return;
        const mapped = data.map(mapProduct);
        const found = mapped.find((item) => item.slug === slug) || null;
        if (isMounted) {
          setProduct(found);
          setExistingMedia(found?.media || []);
        }
      } catch (error) {
        console.error("Load product error:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadProducts();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  const handleDelete = async () => {
    if (!product?.id) {
      showToast("error", "Product id is missing.");
      return;
    }
    const confirmed = window.confirm("Delete this product?");
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Failed to delete product.");
      }
      showToast("success", "Product deleted.");
      setTimeout(() => {
        window.location.href = "/dashboard/products";
      }, 800);
    } catch (error) {
      console.error(error);
      showToast("error", error.message || "Failed to delete product.");
      setIsDeleting(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!product?.id) {
      showToast("error", "Product id is missing.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      brandName: String(formData.get("brandName") || "").trim(),
      category: String(formData.get("category") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      thumbnailUrl: String(formData.get("thumbnailUrl") || "").trim(),
      media: existingMedia,
    };

    if (!payload.name || !payload.category || !payload.description) {
      showToast("error", "Name, category, and description are required.");
      return;
    }
    if (!payload.thumbnailUrl || !isValidUrl(payload.thumbnailUrl)) {
      showToast("error", "Please enter a valid thumbnail URL.");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Failed to update product.");
      }
      const updated = await response.json();
      const mapped = mapProduct(updated);
      setProduct(mapped);
      setExistingMedia(mapped.media || []);
      const newSlug = toSlug(mapped.name);
      if (newSlug && newSlug !== slug) {
        router.replace(`/dashboard/products/${newSlug}`);
      }
      showToast("success", "Product updated.");
      if (mediaFiles.length) {
        const mediaPayload = new FormData();
        mediaFiles.forEach((file) => mediaPayload.append("mediaFile", file));
        const mediaRes = await fetch(
          `/api/products/${encodeURIComponent(product.id)}/media`,
          { method: "POST", body: mediaPayload }
        );
        if (!mediaRes.ok) {
          const errorPayload = await mediaRes.json().catch(() => ({}));
          throw new Error(errorPayload.error || "Failed to upload media.");
        }
        setMediaFiles([]);
        await refreshProduct();
        showToast("success", "Media uploaded.");
      }
    } catch (error) {
      console.error(error);
      showToast("error", error.message || "Failed to update product.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          &larr; Back to products
        </Link>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading product details...</div>
      ) : product ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">{product.brand}</h2>
              <p className="text-sm text-gray-500 mt-1">{product.category}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {product.name}
            </span>
          </div>

          {/* Product Card */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-10">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="border border-blue-300 text-blue-600 px-6 py-2 font-semibold">
                {product.brand}
              </div>
              <div className="text-blue-600 font-semibold">{product.name}</div>
              <div className="w-full max-w-xl">
                <img
                  src={product.image}
                  alt={product.name}
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                  }}
                  className="w-full h-56 object-contain"
                />
              </div>
              <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
                {product.description}
              </p>
            </div>
          </section>

          {/* Edit Product */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900">Edit Product</h3>
            <p className="text-sm text-gray-500 mb-4">Update product details or replace media</p>
            <form className="space-y-4" onSubmit={handleUpdate}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={product.name}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <input
                  type="text"
                  name="brandName"
                  defaultValue={product.brand}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  name="category"
                  defaultValue={product.category}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={4}
                  name="description"
                  defaultValue={product.description}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                <input
                  type="url"
                  name="thumbnailUrl"
                  defaultValue={product.thumbnailUrl}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload media (video/pdf)</label>
                <div
                  {...getRootProps({
                    className: `border-2 border-dashed rounded-lg px-4 py-6 text-sm text-gray-600 cursor-pointer transition ${
                      isDragActive ? "border-blue-400 bg-blue-50" : "border-gray-200"
                    }`,
                  })}
                >
                  <input {...getInputProps()} />
                  <div className="space-y-3">
                    {existingMedia.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase text-gray-500">
                          Existing media
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {existingMedia.map((item) => {
                            const filename = item.url.split("/").pop() || item.url;
                            const ext = filename.split(".").pop()?.toUpperCase() || "";
                            return (
                            <div key={item.url} className="flex flex-col items-center">
                              <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center text-xs text-gray-600 shadow-inner">
                                {item.size ? `${Math.round(item.size / 1024)} KB` : "--"}
                              </div>
                              <div
                                className="mt-2 text-[11px] text-gray-600 truncate w-24 text-center"
                                title={filename}
                              >
                                {filename}
                              </div>
                              {ext && <div className="text-[10px] text-gray-400">{ext}</div>}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const confirmed = window.confirm("Remove this file?");
                                  if (!confirmed) return;
                                  setExistingMedia((prev) => prev.filter((media) => media.url !== item.url));
                                }}
                                className="mt-1 text-xs text-blue-600 underline"
                              >
                                Remove file
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {mediaFiles.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase text-gray-500">
                          New uploads
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {mediaFiles.map((file) => {
                            const ext = file.name.split(".").pop()?.toUpperCase() || "";
                            return (
                            <div key={file.name} className="flex flex-col items-center">
                              <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center text-xs text-gray-600 shadow-inner">
                                {Math.round(file.size / 1024)} KB
                              </div>
                              <div
                                className="mt-2 text-[11px] text-gray-600 truncate w-24 text-center"
                                title={file.name}
                              >
                                {file.name}
                              </div>
                              {ext && <div className="text-[10px] text-gray-400">{ext}</div>}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const confirmed = window.confirm("Remove this file?");
                                  if (!confirmed) return;
                                  setMediaFiles((prev) => prev.filter((item) => item.name !== file.name));
                                }}
                                className="mt-1 text-xs text-blue-600 underline"
                              >
                                Remove file
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {existingMedia.length === 0 && mediaFiles.length === 0 && (
                      <div>
                        <span className="font-medium">Drop files here</span> or click to upload
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-70"
                >
                  {isDeleting ? "Deleting..." : "Delete Product"}
                </button>
              </div>
            </form>
          </section>

        </>
      ) : (
        <div className="text-sm text-gray-500">Product not found.</div>
      )}
    </div>
  );
}
