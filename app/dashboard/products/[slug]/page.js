"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

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

  const handleMediaChange = (event) => {
    const files = Array.from(event.target.files || []);
    setMediaFiles(files);
  };

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
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload media (ppt/pptx/pdf)</label>
                <input
                  type="file"
                  multiple
                  accept=".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
                  onChange={handleMediaChange}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
                <div className="space-y-3 mt-4">
                  {existingMedia.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase text-gray-500">
                        Existing media
                      </div>
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <table className="w-full text-sm text-gray-700">
                          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">File</th>
                              <th className="px-3 py-2 text-left font-semibold">Type</th>
                              <th className="px-3 py-2 text-right font-semibold">Size</th>
                              <th className="px-3 py-2 text-right font-semibold">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {existingMedia.map((item) => {
                              const filename = item.url.split("/").pop() || item.url;
                              const ext = filename.split(".").pop()?.toUpperCase() || "";
                              return (
                                <tr key={item.url} className="border-t border-gray-100">
                                  <td className="px-3 py-2 truncate" title={filename}>
                                    {filename}
                                  </td>
                                  <td className="px-3 py-2">{ext || "--"}</td>
                                  <td className="px-3 py-2 text-right">
                                    {item.size ? `${Math.round(item.size / 1024)} KB` : "--"}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const confirmed = window.confirm("Remove this file?");
                                        if (!confirmed) return;
                                        setExistingMedia((prev) =>
                                          prev.filter((media) => media.url !== item.url)
                                        );
                                      }}
                                      className="text-xs text-blue-600 underline"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {mediaFiles.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase text-gray-500">
                        New uploads
                      </div>
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <table className="w-full text-sm text-gray-700">
                          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">File</th>
                              <th className="px-3 py-2 text-left font-semibold">Type</th>
                              <th className="px-3 py-2 text-right font-semibold">Size</th>
                              <th className="px-3 py-2 text-right font-semibold">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mediaFiles.map((file) => {
                              const ext = file.name.split(".").pop()?.toUpperCase() || "";
                              return (
                                <tr key={file.name} className="border-t border-gray-100">
                                  <td className="px-3 py-2 truncate" title={file.name}>
                                    {file.name}
                                  </td>
                                  <td className="px-3 py-2">{ext || "--"}</td>
                                  <td className="px-3 py-2 text-right">
                                    {Math.round(file.size / 1024)} KB
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const confirmed = window.confirm("Remove this file?");
                                        if (!confirmed) return;
                                        setMediaFiles((prev) =>
                                          prev.filter((item) => item.name !== file.name)
                                        );
                                      }}
                                      className="text-xs text-blue-600 underline"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
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
