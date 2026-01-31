"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";

const toSlug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const mapProduct = (product) => {
  const image =
    product.thumbnailUrl ||
    product.media?.[0]?.url ||
    "/images/product-fallback.svg";

  return {
    id: product._id,
    slug: toSlug(product.name),
    name: product.name,
    brand: product.brandName || "",
    category: product.category,
    description: product.description,
    image,
    mediaCount: Array.isArray(product.media) ? product.media.length : 0,
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

export default function ProductsPage() {
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingMedia, setIsUpdatingMedia] = useState(false);
  const [toast, setToast] = useState(null);
  const [formValues, setFormValues] = useState({
    name: "",
    brand: "",
    category: "",
    description: "",
    thumbnailUrl: "",
  });
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaUpdateFiles, setMediaUpdateFiles] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");

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

  const {
    getRootProps: getUpdateRootProps,
    getInputProps: getUpdateInputProps,
    isDragActive: isUpdateDragActive,
  } = useDropzone({
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "video/*": [],
    },
    onDrop: (acceptedFiles) => {
      setMediaUpdateFiles(acceptedFiles || []);
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

  useEffect(() => {
    let isMounted = true;
    const loadProducts = async () => {
      try {
        const response = await fetch("/api/products");
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data) && isMounted) {
          const sorted = [...data].sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          );
          const mapped = sorted.map(mapProduct);
          setProducts(mapped);
          if (!selectedProductId && mapped.length) {
            setSelectedProductId(mapped[0].id);
          }
        }
      } catch (error) {
        console.error("Load products error:", error);
      }
    };
    loadProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();
    if (!formValues.name || !formValues.category || !formValues.description) {
      showToast("error", "Name, category, and description are required.");
      return;
    }
    if (!formValues.thumbnailUrl || !isValidUrl(formValues.thumbnailUrl)) {
      showToast("error", "Please enter a valid thumbnail URL.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = new FormData();
      payload.append("name", formValues.name);
      payload.append("brandName", formValues.brand);
      payload.append("category", formValues.category);
      payload.append("description", formValues.description);
      payload.append("thumbnailUrl", formValues.thumbnailUrl);
      if (mediaFiles.length) {
        mediaFiles.forEach((file) => {
          payload.append("mediaFile", file);
        });
      }

      const response = await fetch("/api/products", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Failed to save product.");
      }

      const saved = await response.json();
      const mapped = mapProduct(saved);
      setProducts((prev) => [mapped, ...prev]);

      setFormValues({
        name: "",
        brand: "",
        category: "",
        description: "",
        thumbnailUrl: "",
      });
      setMediaFiles([]);
      showToast("success", "Product saved.");
    } catch (error) {
      console.error(error);
      showToast("error", error.message || "Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMedia = async () => {
    if (!selectedProductId) {
      showToast("error", "Please select a product.");
      return;
    }
    if (!mediaUpdateFiles.length) {
      showToast("error", "Please add files to upload.");
      return;
    }
    setIsUpdatingMedia(true);
    try {
      const payload = new FormData();
      mediaUpdateFiles.forEach((file) => payload.append("mediaFile", file));
      const response = await fetch(
        `/api/products/${encodeURIComponent(selectedProductId)}/media`,
        {
          method: "POST",
          body: payload,
        }
      );
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Failed to update media.");
      }
      const updated = await response.json();
      const mapped = mapProduct(updated);
      setProducts((prev) =>
        prev.map((item) => (item.id === mapped.id ? mapped : item))
      );
      setMediaUpdateFiles([]);
      showToast("success", "Media updated.");
    } catch (error) {
      console.error(error);
      showToast("error", error.message || "Failed to update media.");
    } finally {
      setIsUpdatingMedia(false);
    }
  };

  return (
    <div className="space-y-10">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {/* Add Product Card */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Product</h2>
          <button
            type="button"
            aria-label={addProductOpen ? "Collapse" : "Expand"}
            aria-expanded={addProductOpen}
            onClick={() => setAddProductOpen((open) => !open)}
            className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100"
          >
            <span className="text-xl leading-none">{addProductOpen ? "-" : "+"}</span>
          </button>
        </div>
        {addProductOpen && (
          <form className="px-6 py-5 space-y-4" onSubmit={handleSaveProduct}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                placeholder="Product name"
                value={formValues.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                type="text"
                name="brand"
                placeholder="Brand name"
                value={formValues.brand}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                name="category"
                placeholder="Category"
                value={formValues.category}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                name="description"
                placeholder="Product description"
                value={formValues.description}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              ></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
              <input
                type="url"
                name="thumbnailUrl"
                placeholder="https://via.placeholder.com/320x140?text=No+Image"
                value={formValues.thumbnailUrl}
                onChange={handleChange}
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
                {mediaFiles.length ? (
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
                ) : (
                  <div>
                    <span className="font-medium">Drop files here</span> or click to upload
                  </div>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save Product"}
            </button>
          </form>
        )}
      </section>

      {/* Products List */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Products</h2>
          <p className="text-sm text-gray-500">{products.length} items</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Link
              key={product.id || product.slug}
              href={`/dashboard/products/${product.slug}`}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div className="rounded-xl border border-gray-200 bg-white p-2">
                <img
                  src={product.image}
                  alt={product.name}
                  onError={(event) => {
                    event.currentTarget.src = "/images/product-fallback.svg";
                  }}
                  className="w-full h-32 object-contain"
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-blue-600">{product.name}</h3>
                <p className="text-sm font-semibold text-gray-900">{product.brand}</p>
                <p className="text-xs text-gray-500 mb-2">{product.category}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{product.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Edit Product Media */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Product Media</h2>
          <p className="text-sm text-gray-500">Mock update</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
            >
              {products.map((product) => (
                <option key={product.id || product.slug} value={product.id}>
                  {product.brand}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Current media:{" "}
            {products.find((product) => product.id === selectedProductId)?.mediaCount || 0}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Add media (video/pdf)</label>
            <div
              {...getUpdateRootProps({
                className: `border-2 border-dashed rounded-lg px-4 py-6 text-sm text-gray-600 cursor-pointer transition ${
                  isUpdateDragActive ? "border-blue-400 bg-blue-50" : "border-gray-200"
                }`,
              })}
            >
              <input {...getUpdateInputProps()} />
              {mediaUpdateFiles.length ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {mediaUpdateFiles.map((file) => {
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
                          setMediaUpdateFiles((prev) => prev.filter((item) => item.name !== file.name));
                        }}
                        className="mt-1 text-xs text-blue-600 underline"
                      >
                        Remove file
                      </button>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <span className="font-medium">Drop files here</span> or click to upload
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleUpdateMedia}
            disabled={isUpdatingMedia}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {isUpdatingMedia ? "Updating..." : "Update Media"}
          </button>
        </div>
      </section>
    </div>
  );
}
