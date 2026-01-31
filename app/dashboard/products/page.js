"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    "https://via.placeholder.com/320x180?text=No+Image";

  return {
    id: product._id,
    slug: toSlug(product.name),
    name: product.name,
    brand: product.brandName || "",
    category: product.category,
    description: product.description,
    image,
  };
};

export default function ProductsPage() {
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    brand: "",
    category: "",
    description: "",
    thumbnailUrl: "",
    mediaUrls: "",
  });
  const [mediaFile, setMediaFile] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadProducts = async () => {
      try {
        const response = await fetch("/api/products");
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data) && isMounted) {
          setProducts(data.map(mapProduct));
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
      alert("Name, category, and description are required.");
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
      payload.append("mediaUrls", formValues.mediaUrls);
      if (mediaFile) {
        payload.append("mediaFile", mediaFile);
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
        mediaUrls: "",
      });
      setMediaFile(null);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10">
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
                type="text"
                name="thumbnailUrl"
                placeholder="https://via.placeholder.com/320x140?text=No+Image"
                value={formValues.thumbnailUrl}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Media (comma URLs)</label>
              <input
                type="text"
                name="mediaUrls"
                placeholder="https://...mp4, https://...pdf"
                value={formValues.mediaUrls}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload media (video/pdf)</label>
              <input
                type="file"
                onChange={(event) => setMediaFile(event.target.files?.[0] || null)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-gray-700"
              />
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
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200">
              {products.map((product) => (
                <option key={product.id || product.slug}>{product.brand}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500">Current media: 2</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add media (video/pdf)</label>
            <input
              type="file"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-gray-700"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Update Media
          </button>
        </div>
      </section>
    </div>
  );
}
