"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const toSlug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildProductSlug = (product) =>
  toSlug(`${product?.name || ""}-${product?.brandName || product?.brand || ""}`);

const FALLBACK_IMAGE = "/images/product-fallback.svg";
const CONVERTED_PREFIX = "/uploads/converted/";

const isImageUrl = (value = "") => /(png|jpg|jpeg|gif|webp)$/i.test(value);

const toFlatMedia = (media = []) => {
  if (!Array.isArray(media) || media.length === 0) return [];
  if (media[0] && Array.isArray(media[0].items)) {
    return media.flatMap((group) =>
      (group.items || []).map((item) => ({
        ...item,
        url: item?.url,
        groupId: group.groupId || item?.groupId,
      }))
    );
  }
  return media;
};

const mapProduct = (product) => {
  const flatMedia = toFlatMedia(product.media);
  const image =
    product.thumbnailUrl ||
    flatMedia?.[0]?.url ||
    FALLBACK_IMAGE;

  return {
    id: product._id?.toString?.() || product._id || product.id || "",
    slug: buildProductSlug(product),
    name: product.name,
    brand: product.brandName || "",
    category: product.category,
    description: product.description,
    image,
    thumbnailUrl: product.thumbnailUrl || "",
    media: flatMedia.map((item) => ({
      url: item.url,
      type: item.type,
      title: item.title,
      size: item.size,
      status: item.status,
      groupId: item.groupId,
      sourceName: item.sourceName,
      hotspots: Array.isArray(item.hotspots) ? item.hotspots : [],
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

const groupExistingMedia = (mediaItems) => {
  const groups = new Map();

  mediaItems.forEach((item) => {
    const url = item.url || "";
    if (item.groupId) {
      const key = `group:${item.groupId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: item.sourceName || item.originalName || item.groupId,
          items: [],
        });
      }
      groups.get(key).items.push(item);
      return;
    }
    const convertedIndex = url.indexOf(CONVERTED_PREFIX);
    if (convertedIndex !== -1) {
      const rest = url.slice(convertedIndex + CONVERTED_PREFIX.length);
      const folderName = rest.split("/")[0] || "converted";
      const labelBase = folderName.replace(/^\d+-/, "");
      const label = labelBase ? `${labelBase} (converted)` : "Converted media";
      const key = `converted:${folderName}`;
      if (!groups.has(key)) {
        groups.set(key, { key, label, items: [] });
      }
      groups.get(key).items.push(item);
      return;
    }

    const filename = url.split("/").pop() || url || "Media file";
    const key = `file:${filename}`;
    if (!groups.has(key)) {
      groups.set(key, { key, label: filename, items: [] });
    }
    groups.get(key).items.push(item);
  });

  return Array.from(groups.values());
};

const getGroupId = (group) => {
  const first = group.items?.[0];
  if (first?.groupId) return first.groupId;
  if (group.key?.startsWith("group:")) return group.key.replace("group:", "");
  if (group.key?.startsWith("converted:")) return group.key.replace("converted:", "");
  if (group.key?.startsWith("file:")) return group.key.replace("file:", "");
  return group.key || "unknown-group";
};

const buildGroupPages = (group) =>
  (group.items || [])
    .filter((item) => isImageUrl(item.url))
    .map((item, idx) => ({
      pageId: item.url,
      index: idx + 1,
      imageUrl: item.url,
      filename: item.url.split("/").pop() || item.url,
    }));

const getHotspotCount = (item) =>
  Array.isArray(item?.hotspots) ? item.hotspots.length : 0;

const HotspotEditor = ({
  isOpen,
  groupId,
  pages,
  initialHotspotsByPage,
  initialPageId,
  onSave,
  onClose,
}) => {
  const containerRef = useRef(null);
  const [currentPageId, setCurrentPageId] = useState(pages?.[0]?.pageId || "");
  const [hotspotsByPage, setHotspotsByPage] = useState(initialHotspotsByPage || {});
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [shape, setShape] = useState("rectangle");

  useEffect(() => {
    if (!isOpen) return;
    const preferredPage = initialPageId || pages?.[0]?.pageId || "";
    setCurrentPageId(preferredPage);
    setHotspotsByPage(initialHotspotsByPage || {});
    setSelectedId(null);
    setDraft(null);
    setDrawMode(false);
    setIsPreview(false);
    setActiveAction(null);
    setShape("rectangle");
  }, [isOpen, pages, initialHotspotsByPage, initialPageId]);

  if (!isOpen) return null;

  const currentPage = pages.find((page) => page.pageId === currentPageId) || pages[0];
  const hotspots = hotspotsByPage[currentPage?.pageId] || [];
  const totalHotspots = Object.values(hotspotsByPage || {}).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );

  const updateHotspotsForCurrentPage = (next) => {
    if (!currentPage?.pageId) return;
    setHotspotsByPage((prev) => ({
      ...prev,
      [currentPage.pageId]: next,
    }));
  };

  const getRelativePoint = (event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    return { x, y };
  };
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const minSize = 0.02;

  const handlePointerDown = (event) => {
    if (!drawMode || !currentPage) return;
    event.preventDefault();
    const start = getRelativePoint(event);
    setIsDrawing(true);
    setDraft({
      id: `draft-${Date.now()}`,
      x: start.x,
      y: start.y,
      w: 0,
      h: 0,
      startX: start.x,
      startY: start.y,
      shape,
      targetPageId: "",
    });
  };

  const handlePointerMove = (event) => {
    if (!isDrawing || !draft) return;
    event.preventDefault();
    const current = getRelativePoint(event);
    const startX = draft.startX ?? draft.x;
    const startY = draft.startY ?? draft.y;
    const x = Math.min(startX, current.x);
    const y = Math.min(startY, current.y);
    const w = Math.abs(current.x - startX);
    const h = Math.abs(current.y - startY);
    setDraft((prev) => ({ ...prev, x, y, w, h }));
  };

  const handlePointerUp = () => {
    if (!isDrawing || !draft) return;
    setIsDrawing(false);
    if (draft.w < minSize || draft.h < minSize) {
      setDraft(null);
      return;
    }
    const newHotspot = {
      id: `hotspot-${Date.now()}`,
      x: draft.x,
      y: draft.y,
      w: draft.w,
      h: draft.h,
      shape: draft.shape || shape,
      targetPageId: "",
    };
    updateHotspotsForCurrentPage([...hotspots, newHotspot]);
    setSelectedId(newHotspot.id);
    setDraft(null);
  };

  const beginMove = (event, spot) => {
    if (drawMode || isPreview) return;
    event.preventDefault();
    event.stopPropagation();
    const start = getRelativePoint(event);
    setSelectedId(spot.id);
    setActiveAction({
      type: "move",
      id: spot.id,
      start,
      origin: { x: spot.x, y: spot.y, w: spot.w, h: spot.h },
    });
  };

  const beginResize = (event, spot, handle) => {
    if (drawMode || isPreview) return;
    event.preventDefault();
    event.stopPropagation();
    const start = getRelativePoint(event);
    setSelectedId(spot.id);
    setActiveAction({
      type: "resize",
      id: spot.id,
      handle,
      start,
      origin: { x: spot.x, y: spot.y, w: spot.w, h: spot.h },
    });
  };

  const handleActionMove = (event) => {
    if (!activeAction) return;
    event.preventDefault();
    const point = getRelativePoint(event);
    const dx = point.x - activeAction.start.x;
    const dy = point.y - activeAction.start.y;
    updateHotspotsForCurrentPage(
      hotspots.map((spot) => {
        if (spot.id !== activeAction.id) return spot;
        if (activeAction.type === "move") {
          const nextX = clamp(
            activeAction.origin.x + dx,
            0,
            1 - activeAction.origin.w
          );
          const nextY = clamp(
            activeAction.origin.y + dy,
            0,
            1 - activeAction.origin.h
          );
          return { ...spot, x: nextX, y: nextY };
        }
        if (activeAction.type === "resize") {
          let { x, y, w, h } = activeAction.origin;
          if (activeAction.handle === "se") {
            w = clamp(activeAction.origin.w + dx, minSize, 1 - x);
            h = clamp(activeAction.origin.h + dy, minSize, 1 - y);
          }
          if (activeAction.handle === "sw") {
            const newX = clamp(activeAction.origin.x + dx, 0, x + w - minSize);
            w = clamp(x + w - newX, minSize, 1 - newX);
            x = newX;
            h = clamp(activeAction.origin.h + dy, minSize, 1 - y);
          }
          if (activeAction.handle === "ne") {
            const newY = clamp(activeAction.origin.y + dy, 0, y + h - minSize);
            h = clamp(y + h - newY, minSize, 1 - newY);
            y = newY;
            w = clamp(activeAction.origin.w + dx, minSize, 1 - x);
          }
          if (activeAction.handle === "nw") {
            const newX = clamp(activeAction.origin.x + dx, 0, x + w - minSize);
            const newY = clamp(activeAction.origin.y + dy, 0, y + h - minSize);
            w = clamp(x + w - newX, minSize, 1 - newX);
            h = clamp(y + h - newY, minSize, 1 - newY);
            x = newX;
            y = newY;
          }
          return { ...spot, x, y, w, h };
        }
        return spot;
      })
    );
  };

  const handleActionEnd = () => {
    if (!activeAction) return;
    setActiveAction(null);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    updateHotspotsForCurrentPage(hotspots.filter((spot) => spot.id !== selectedId));
    setSelectedId(null);
  };

  const handleSave = () => {
    onSave(hotspotsByPage);
    onClose();
  };

  const handleHotspotClick = (spot) => {
    if (drawMode) {
      setDrawMode(false);
    }
    if (isPreview && spot.targetPageId) {
      setCurrentPageId(spot.targetPageId);
      return;
    }
    setSelectedId(spot.id);
  };
  const shapeClassName = (value) => {
    if (value === "circle" || value === "pill") return "rounded-full";
    if (value === "round-rectangle") return "rounded-lg";
    return "rounded-none";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-6xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Edit Hotspots</h3>
            <p className="text-xs text-gray-500">Group: {groupId}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            &#10005;
          </button>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDrawMode((prev) => !prev);
                  setIsPreview(false);
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                  drawMode
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                {drawMode ? "Drawing Hotspot" : "Add Hotspot"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPreview((prev) => !prev);
                  setDrawMode(false);
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                  isPreview
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                {isPreview ? "Preview On" : "Preview"}
              </button>
              <div className="flex items-center gap-2">
                {[
                  { value: "rectangle", label: "Rectangle" },
                  { value: "round-rectangle", label: "Round Rect" },
                  { value: "circle", label: "Circle" },
                  { value: "pill", label: "Pill" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setShape(item.value)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                      shape === item.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400">
                {drawMode ? "Drag to draw" : "Select a hotspot"}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">
                {totalHotspots} total
              </span>
            </div>
            <div
              ref={containerRef}
              className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
              onMouseDown={handlePointerDown}
              onMouseMove={(event) => {
                handlePointerMove(event);
                handleActionMove(event);
              }}
              onMouseUp={() => {
                handlePointerUp();
                handleActionEnd();
              }}
              onMouseLeave={() => {
                handlePointerUp();
                handleActionEnd();
              }}
            >
              {currentPage?.imageUrl ? (
                <img
                  src={currentPage.imageUrl}
                  alt={currentPage.filename || "page"}
                  className="block h-auto w-full select-none object-contain"
                  onMouseDown={(event) => event.preventDefault()}
                  draggable={false}
                />
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-gray-400">
                  Select a page to edit.
                </div>
              )}
              {hotspots.map((spot, index) => (
                <div
                  key={spot.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleHotspotClick(spot)}
                  onMouseDown={(event) => {
                    if (drawMode) {
                      event.stopPropagation();
                      setDrawMode(false);
                    }
                    setSelectedId(spot.id);
                    if (!drawMode && !isPreview) {
                      beginMove(event, spot);
                    }
                  }}
                  className={`absolute ${shapeClassName(spot.shape)} border-2 ${
                    selectedId === spot.id
                      ? "border-blue-500 bg-blue-100/40"
                      : "border-amber-400 bg-amber-100/30"
                  } z-10`}
                  style={{
                    left: `${spot.x * 100}%`,
                    top: `${spot.y * 100}%`,
                    width: `${spot.w * 100}%`,
                    height: `${spot.h * 100}%`,
                  }}
                >
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {index + 1}
                  </span>
                  {selectedId === spot.id && !isPreview && !drawMode && (
                    <>
                      <button
                        type="button"
                        onMouseDown={(event) => beginResize(event, spot, "nw")}
                        className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border border-white bg-blue-600"
                      />
                      <button
                        type="button"
                        onMouseDown={(event) => beginResize(event, spot, "ne")}
                        className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border border-white bg-blue-600"
                      />
                      <button
                        type="button"
                        onMouseDown={(event) => beginResize(event, spot, "sw")}
                        className="absolute -left-1.5 -bottom-1.5 h-3 w-3 rounded-full border border-white bg-blue-600"
                      />
                      <button
                        type="button"
                        onMouseDown={(event) => beginResize(event, spot, "se")}
                        className="absolute -right-1.5 -bottom-1.5 h-3 w-3 rounded-full border border-white bg-blue-600"
                      />
                    </>
                  )}
                </div>
              ))}
              {draft && (
                <div
                  className={`absolute ${shapeClassName(draft.shape)} border-2 border-dashed border-blue-400 bg-blue-100/20`}
                  style={{
                    left: `${draft.x * 100}%`,
                    top: `${draft.y * 100}%`,
                    width: `${draft.w * 100}%`,
                    height: `${draft.h * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">Pages</div>
              <div className="mt-3 space-y-2">
                {pages.map((page) => (
                  <button
                    key={page.pageId}
                    type="button"
                    onClick={() => setCurrentPageId(page.pageId)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${
                      page.pageId === currentPage?.pageId
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-700"
                    }`}
                  >
                    <span className="text-xs font-semibold">{page.index}</span>
                    <span className="truncate">{page.filename}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase text-gray-500">Hotspots</div>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={!selectedId}
                  className="text-xs font-semibold text-red-500 disabled:opacity-40"
                >
                  Delete Selected
                </button>
              </div>
              <div className="mt-2 text-[11px] text-gray-400">
                {hotspots.length} on this slide
              </div>
              <div className="mt-3 space-y-3">
                {hotspots.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400">
                    No hotspots yet. Use Add Hotspot to draw.
                  </div>
                )}
                {hotspots.map((spot, index) => (
                  <div
                    key={spot.id}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      selectedId === spot.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(spot.id)}
                      className="mb-2 text-left font-semibold text-gray-700"
                    >
                      Hotspot {index + 1}
                    </button>
                    <label className="block text-[11px] font-medium text-gray-500">
                      Target slide
                    </label>
                    <label className="mt-2 block text-[11px] font-medium text-gray-500">
                      Shape
                    </label>
                    <select
                      value={spot.shape || "rectangle"}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateHotspotsForCurrentPage(
                          hotspots.map((item) =>
                            item.id === spot.id ? { ...item, shape: value } : item
                          )
                        );
                      }}
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
                    >
                      <option value="rectangle">Rectangle</option>
                      <option value="round-rectangle">Round rectangle</option>
                      <option value="circle">Circle</option>
                      <option value="pill">Pill</option>
                    </select>
                    <select
                      value={spot.targetPageId || ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateHotspotsForCurrentPage(
                          hotspots.map((item) =>
                            item.id === spot.id ? { ...item, targetPageId: value } : item
                          )
                        );
                      }}
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
                    >
                      <option value="">Select target</option>
                      {pages.map((page) => (
                        <option key={page.pageId} value={page.pageId}>
                          Slide {page.index}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <div className="text-xs text-gray-400">
            {isPreview
              ? "Preview mode: click a hotspot to jump to its target slide."
              : "Edit mode: select a hotspot to set its target slide."}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Save Hotspots
            </button>
          </div>
        </div>
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
  const mediaInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const formRef = useRef(null);
  const [hotspotEditor, setHotspotEditor] = useState({
    isOpen: false,
    groupId: "",
    pages: [],
    initialHotspotsByPage: {},
    initialPageId: "",
  });
  const [mediaPreview, setMediaPreview] = useState({
    isOpen: false,
    url: "",
    filename: "",
  });

  const handleMediaChange = (event) => {
    const files = Array.from(event.target.files || []);
    setMediaFiles(files);
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshProduct = async () => {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) return;
      const data = await response.json();
      const productsPayload = Array.isArray(data) ? data : data?.products;
      if (!Array.isArray(productsPayload)) return;
      const mapped = productsPayload.map(mapProduct);
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
        const productsPayload = Array.isArray(data) ? data : data?.products;
        if (!Array.isArray(productsPayload)) return;
        const mapped = productsPayload.map(mapProduct);
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

  useEffect(() => {
    const hasPending = existingMedia.some(
      (item) =>
        item?.status === "pending" ||
        (item?.url || "").startsWith("/uploads/queue/")
    );
    if (!hasPending) return undefined;

    const timer = setInterval(() => {
      refreshProduct();
    }, 10000);

    return () => clearInterval(timer);
  }, [existingMedia]);

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

  const buildPayloadFromForm = (sourceForm, mediaOverride) => {
    const formData = new FormData(sourceForm);
    return {
      name: String(formData.get("name") || "").trim(),
      brandName: String(formData.get("brandName") || "").trim(),
      category: String(formData.get("category") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      thumbnailUrl: product?.thumbnailUrl || "",
      media: mediaOverride || existingMedia,
    };
  };

  const persistProduct = async (payload, { silent } = {}) => {
    if (!product?.id) {
      showToast("error", "Product id is missing.");
      return null;
    }
    try {
      if (!silent) setIsUpdating(true);
      const isFormData =
        typeof FormData !== "undefined" && payload instanceof FormData;
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "PUT",
        headers: isFormData ? undefined : { "Content-Type": "application/json" },
        body: isFormData ? payload : JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Failed to update product.");
      }
      const updated = await response.json();
      const mapped = mapProduct(updated);
      setProduct(mapped);
      setExistingMedia(mapped.media || []);
      const newSlug = buildProductSlug(mapped);
      if (newSlug && newSlug !== slug) {
        router.replace(`/dashboard/products/${newSlug}`);
      }
      return mapped;
    } catch (error) {
      console.error(error);
      showToast("error", error.message || "Failed to update product.");
      return null;
    } finally {
      if (!silent) setIsUpdating(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!product?.id) {
      showToast("error", "Product id is missing.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const brandName = String(formData.get("brandName") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const thumbnailFile = formData.get("thumbnailFile");
    const hasThumbnailFile =
      thumbnailFile && typeof thumbnailFile === "object" && thumbnailFile.size > 0;

    if (!name || !category || !description) {
      showToast("error", "Name, category, and description are required.");
      return;
    }
    if (!product.thumbnailUrl && !hasThumbnailFile) {
      showToast("error", "Please upload a thumbnail image.");
      return;
    }

    try {
      const updatePayload = new FormData();
      updatePayload.append("name", name);
      updatePayload.append("brandName", brandName);
      updatePayload.append("category", category);
      updatePayload.append("description", description);
      updatePayload.append("media", JSON.stringify(existingMedia));
      if (hasThumbnailFile) {
        updatePayload.append("thumbnailFile", thumbnailFile);
      }
      const mapped = await persistProduct(updatePayload);
      if (!mapped) return;
      showToast("success", "Product updated.");
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = "";
      }
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
        if (mediaInputRef.current) {
          mediaInputRef.current.value = "";
        }
        await refreshProduct();
        showToast("success", "Media uploaded.");
      }
    } catch (error) {
      console.error(error);
      showToast("error", error.message || "Failed to update product.");
    }
  };

  const groupedExistingMedia = groupExistingMedia(existingMedia);

  const openHotspotEditor = (group, item) => {
    const pages = buildGroupPages(group);
    const groupId = getGroupId(group);
    const initialHotspotsByPage = pages.reduce((acc, page) => {
      const mediaItem = existingMedia.find((entry) => entry.url === page.pageId);
      acc[page.pageId] = Array.isArray(mediaItem?.hotspots) ? mediaItem.hotspots : [];
      return acc;
    }, {});
    setHotspotEditor({
      isOpen: true,
      groupId,
      pages,
      initialHotspotsByPage,
      initialPageId: item.url,
    });
  };

  const saveHotspotsForGroup = async (nextHotspotsByPage) => {
    const nextMedia = existingMedia.map((item) =>
      nextHotspotsByPage[item.url]
        ? { ...item, hotspots: nextHotspotsByPage[item.url] }
        : item
    );
    setExistingMedia(nextMedia);
    if (!formRef.current) return;
    const payload = buildPayloadFromForm(formRef.current, nextMedia);
    const updated = await persistProduct(payload, { silent: true });
    if (updated) {
      showToast("success", "Hotspots saved.");
    }
  };

  return (
    <div className="space-y-8">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {mediaPreview.isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="text-sm font-semibold text-gray-800 truncate">
                {mediaPreview.filename || "Preview"}
              </div>
              <button
                type="button"
                onClick={() => setMediaPreview({ isOpen: false, url: "", filename: "" })}
                className="text-gray-400 hover:text-gray-600"
              >
                &#10005;
              </button>
            </div>
            <div className="flex items-center justify-center bg-gray-50 p-6">
              <img
                src={mediaPreview.url}
                alt={mediaPreview.filename || "Preview"}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
      <HotspotEditor
        isOpen={hotspotEditor.isOpen}
        groupId={hotspotEditor.groupId}
        pages={hotspotEditor.pages}
        initialHotspotsByPage={hotspotEditor.initialHotspotsByPage}
        initialPageId={hotspotEditor.initialPageId}
        onSave={saveHotspotsForGroup}
        onClose={() =>
          setHotspotEditor({
            isOpen: false,
            groupId: "",
            pages: [],
            initialHotspotsByPage: {},
            initialPageId: "",
          })
        }
      />
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
            <form ref={formRef} className="space-y-4" onSubmit={handleUpdate}>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail Image</label>
                {product.thumbnailUrl ? (
                  <div className="mb-3 rounded-xl border border-gray-200 bg-white p-2">
                    <img
                      src={product.thumbnailUrl}
                      alt={`${product.name} thumbnail`}
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_IMAGE;
                      }}
                      className="h-40 w-full object-contain"
                    />
                  </div>
                ) : null}
                <input
                  type="file"
                  name="thumbnailFile"
                  accept="image/*"
                  ref={thumbnailInputRef}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload media (ppt/pptx/pdf)</label>
                <input
                  type="file"
                  multiple
                  accept=".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
                  onChange={handleMediaChange}
                  ref={mediaInputRef}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
                <div className="space-y-3 mt-4">
                  {existingMedia.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase text-gray-500">
                        Existing media
                      </div>
                      <div className="space-y-3">
                        {groupedExistingMedia.map((group) => {
                          const pendingOnly =
                            group.items.length > 0 &&
                            group.items.every(
                              (item) =>
                                item.status === "pending" ||
                                (item.url || "").startsWith("/uploads/queue/")
                            );
                          const headerLabel = group.label;
                          return (
                          <details
                            key={group.key}
                            className="rounded-lg border border-gray-200 bg-white"
                          >
                            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-gray-700">
                              <span className="truncate">{headerLabel}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-gray-400">
                                  {group.items.length} file{group.items.length === 1 ? "" : "s"}
                                </span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    const confirmed = window.confirm(
                                      "Remove all media in this group?"
                                    );
                                    if (!confirmed) return;
                                    const urlsToRemove = new Set(
                                      group.items.map((item) => item.url)
                                    );
                                    setExistingMedia((prev) =>
                                      prev.filter((item) => !urlsToRemove.has(item.url))
                                    );
                                  }}
                                  className="text-xs font-medium text-red-600 underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </summary>
                            <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                              <div className="space-y-2">
                                {pendingOnly ? (
                                  <div className="text-sm text-gray-500">
                                    Converting to images in progress.
                                  </div>
                                ) : (
                                  group.items.map((item) => {
                                    const filename = item.url.split("/").pop() || item.url;
                                    const ext = filename.split(".").pop()?.toUpperCase() || "";
                                    const isImage = isImageUrl(filename);
                                    return (
                                      <div
                                        key={item.url}
                                        className="flex flex-col gap-2 rounded-md border border-gray-100 p-3 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div className="flex items-center gap-3">
                                          {isImage && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setMediaPreview({
                                                  isOpen: true,
                                                  url: item.url,
                                                  filename,
                                                })
                                              }
                                              className="h-12 w-12 overflow-hidden rounded border border-gray-200"
                                            >
                                              <img
                                                src={item.url}
                                                alt={filename}
                                                className="h-full w-full object-cover"
                                              />
                                            </button>
                                          )}
                                          <div className="min-w-0">
                                            <div className="truncate" title={filename}>
                                              {filename}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                              {ext || "--"}
                                              {item.size ? ` • ${Math.round(item.size / 1024)} KB` : ""}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {isImage && (
                                            <button
                                              type="button"
                                              onClick={() => openHotspotEditor(group, item)}
                                              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                                            >
                                              Hotspot
                                            </button>
                                          )}
                                          {isImage && (
                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">
                                              {getHotspotCount(item)} hotspot
                                              {getHotspotCount(item) === 1 ? "" : "s"}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </details>
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
