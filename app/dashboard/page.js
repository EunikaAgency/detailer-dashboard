"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [stats, setStats] = useState({ products: 0 });
  const [categoryRows, setCategoryRows] = useState([]);
  const [brandRows, setBrandRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const productsRes = await fetch("/api/products");

        const productsData = productsRes.ok ? await productsRes.json() : [];
        const productsPayload = Array.isArray(productsData)
          ? productsData
          : productsData?.products;
        const safeProducts = Array.isArray(productsPayload) ? productsPayload : [];
        const categoryCounts = safeProducts.reduce((acc, product) => {
          const rawCategory = typeof product?.category === "string" ? product.category : "";
          const category = rawCategory.trim() || "Uncategorized";
          acc.set(category, (acc.get(category) || 0) + 1);
          return acc;
        }, new Map());
        const rows = Array.from(categoryCounts.entries())
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
        const brandCounts = safeProducts.reduce((acc, product) => {
          const rawBrand = typeof product?.brandName === "string" ? product.brandName : "";
          const brand = rawBrand.trim() || "Unbranded";
          acc.set(brand, (acc.get(brand) || 0) + 1);
          return acc;
        }, new Map());
        const brands = Array.from(brandCounts.entries())
          .map(([brand, count]) => ({ brand, count }))
          .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand));

        if (isMounted) {
          setStats({
            products: safeProducts.length,
          });
          setCategoryRows(rows);
          setBrandRows(brands);
        }
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Products Card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-2">Products</p>
              <p className="text-4xl font-bold text-gray-900">
                {isLoading ? "-" : stats.products}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Product Categories</h2>
            <p className="text-sm text-gray-600">Distribution of products by category</p>
          </div>

          {isLoading ? (
            <div className="text-sm text-gray-500">Loading categories...</div>
          ) : categoryRows.length === 0 ? (
            <div className="text-sm text-gray-500">No product categories yet.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Category</th>
                    <th className="px-4 py-3 text-right font-semibold">Products</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((row) => (
                    <tr key={row.category} className="border-t border-gray-100">
                      <td className="px-4 py-3">{row.category}</td>
                      <td className="px-4 py-3 text-right font-medium">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Product Brands</h2>
            <p className="text-sm text-gray-600">Distribution of products by brand</p>
          </div>

          {isLoading ? (
            <div className="text-sm text-gray-500">Loading brands...</div>
          ) : brandRows.length === 0 ? (
            <div className="text-sm text-gray-500">No product brands yet.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Brand</th>
                    <th className="px-4 py-3 text-right font-semibold">Products</th>
                  </tr>
                </thead>
                <tbody>
                  {brandRows.map((row) => (
                    <tr key={row.brand} className="border-t border-gray-100">
                      <td className="px-4 py-3">{row.brand}</td>
                      <td className="px-4 py-3 text-right font-medium">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
