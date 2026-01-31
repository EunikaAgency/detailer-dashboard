"use client";

import { useParams } from "next/navigation";
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
    "https://via.placeholder.com/720x320?text=No+Image";

  return {
    id: product._id,
    slug: toSlug(product.name),
    name: product.name,
    brand: product.brandName || "",
    category: product.category,
    description: product.description,
    image,
    thumbnailUrl: product.thumbnailUrl || "",
    mediaUrls: (product.media || []).map((item) => item.url).join(", "),
  };
};

export default function ProductDetailPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          ← Back to products
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
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  defaultValue={product.brand}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <input
                  type="text"
                  defaultValue={product.name}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  defaultValue={product.category}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={4}
                  defaultValue={product.description}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                <input
                  type="text"
                  defaultValue={product.thumbnailUrl}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Media (comma URLs)</label>
                <input
                  type="text"
                  defaultValue={product.mediaUrls}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                >
                  Delete Product
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
