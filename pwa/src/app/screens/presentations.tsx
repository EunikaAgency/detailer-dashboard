import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { FilterChip } from "../components/ui/filter-chip";
import { Pill } from "../components/ui/pill";
import { ActionButton } from "../components/ui/action-button";
import { Menu, Home, RefreshCw, LogOut, Search, AlertCircle, Download } from "lucide-react";
import { logout } from "../lib/auth";
import { trackEvent, syncPendingEvents } from "../lib/sessions";
import { getProducts, getCategories, type Product } from "../lib/products";
import { getUIText, initializeConfig } from "../lib/config";
import { useAppSettings, type GalleryColumns } from "../lib/settings";
import {
  cacheProductsForOffline,
  estimateOfflineDownloadNeed,
  getOfflinePresentationSummary,
  warmProductMediaCache,
} from "../lib/media-cache";
import { buildDomId } from "../lib/dom-ids";

const gridClassMap: Record<GalleryColumns, string> = {
  1: "grid gap-4 grid-cols-1",
  2: "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-2",
  3: "grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-3",
  4: "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

export default function Presentations() {
  const screenId = "presentations-screen";
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'cached' | 'bundled'>('bundled');
  const [error, setError] = useState<string | null>(null);
  const [offlineSummary, setOfflineSummary] = useState(() => getOfflinePresentationSummary());
  const settings = useAppSettings();
  const manualOfflineMode = settings.offlineAccessMode === "manual";
  const iconOnlyActions = settings.actionLabels === "icons";

  // Get UI text labels
  const uiText = {
    title: getUIText('productsTitle'),
    searchPlaceholder: getUIText('searchPlaceholder'),
    syncButton: getUIText('syncButton'),
    logoutButton: getUIText('logoutButton'),
  };

  // Get settings
  // Track screen view on mount
  useEffect(() => {
    trackEvent('activity', 'screen_view', 'presentations');
  }, []);

  // Load products and config
  useEffect(() => {
    const refreshOfflineSummary = () => {
      setOfflineSummary(getOfflinePresentationSummary());
    };

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // Initialize config in background
        initializeConfig().catch(console.error);

        // Fetch products with fallback
        const result = await getProducts();
        setProducts(result.products);
        setDataSource(result.source);
        setCategories(getCategories(result.products));
        void warmProductMediaCache(result.products);
        if (settings.offlineAccessMode === "automatic" && navigator.onLine) {
          void Promise.all(result.products.map((product) => estimateOfflineDownloadNeed(product))).then((estimates) => {
            const downloadCandidates = result.products.filter((_, index) => !estimates[index]?.lowHeadroom);
            if (downloadCandidates.length === 0) {
              return;
            }
            return cacheProductsForOffline(downloadCandidates).then(() => {
              setOfflineSummary(getOfflinePresentationSummary());
            });
          });
        }
        refreshOfflineSummary();
      } catch (err) {
        setError('Failed to load presentations');
        console.error('Failed to load products:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [settings.offlineAccessMode]);

  const filteredPresentations = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSync = async () => {
    setIsSyncing(true);
    
    // Sync pending events
    await syncPendingEvents();
    
    // Refresh products
    try {
      const result = await getProducts();
      setProducts(result.products);
      setDataSource(result.source);
      setCategories(getCategories(result.products));
      void warmProductMediaCache(result.products);
      if (settings.offlineAccessMode === "automatic" && navigator.onLine) {
        void Promise.all(result.products.map((product) => estimateOfflineDownloadNeed(product))).then((estimates) => {
          const downloadCandidates = result.products.filter((_, index) => !estimates[index]?.lowHeadroom);
          if (downloadCandidates.length === 0) {
            return;
          }
          return cacheProductsForOffline(downloadCandidates).then(() => {
            setOfflineSummary(getOfflinePresentationSummary());
          });
        });
      }
      setOfflineSummary(getOfflinePresentationSummary());
      setError(null);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadOffline = async () => {
    if (products.length === 0) {
      return;
    }

    const estimates = await Promise.all(products.map((product) => estimateOfflineDownloadNeed(product)));
    const lowHeadroomProducts = estimates.filter((estimate) => estimate.lowHeadroom);
    if (
      lowHeadroomProducts.length > 0 &&
      !window.confirm("Storage is running low. Continue downloading offline presentations anyway?")
    ) {
      return;
    }

    setIsDownloadingOffline(true);
    setError(null);

    try {
      const result = await cacheProductsForOffline(products);
      setOfflineSummary(getOfflinePresentationSummary());
      window.alert(
        `Offline library updated.\nCached ${result.cached} assets across ${products.length} presentations.`
      );
    } catch (err) {
      console.error("Offline caching failed:", err);
      setError("Failed to cache presentations for offline use");
    } finally {
      setIsDownloadingOffline(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const goHome = () => navigate("/presentations#presentations-screen-content");

  const offlineProductIds = new Set(offlineSummary.records.map((record) => record.productId));

  if (isLoading) {
    return (
      <div id={`${screenId}-loading`} className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div id={`${screenId}-loading-content`} className="text-center">
          <div
            id={`${screenId}-loading-spinner`}
            className="inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"
          />
          <div id={`${screenId}-loading-label`} className="text-sm text-slate-600">Loading presentations...</div>
        </div>
      </div>
    );
  }

  return (
    <div id={`${screenId}-root`} className="min-h-screen pb-6">
      <header
        id={`${screenId}-header`}
        className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-slate-200 px-4 py-3"
      >
        <div id={`${screenId}-header-content`} className="max-w-screen-xl mx-auto">
          <div
            id={`${screenId}-header-top-row`}
            className={`flex items-center gap-2 ${iconOnlyActions ? "justify-between" : "flex-wrap"}`}
          >
            <div
              id={`${screenId}-header-primary`}
              className={`flex items-center gap-2 ${iconOnlyActions ? "shrink-0" : "w-full sm:w-auto"}`}
            >
              <ActionButton
                id={`${screenId}-menu-button`}
                onClick={() => navigate("/menu")}
                aria-label="Open menu"
                label="Menu"
                icon={<Menu className="w-5 h-5" />}
              />
              <ActionButton
                id={`${screenId}-home-button`}
                onClick={goHome}
                aria-label="Go to presentations"
                label="Home"
                icon={<Home className="w-5 h-5" />}
              />
            </div>

            <div
              id={`${screenId}-header-actions`}
              className={`flex items-center justify-end gap-2 ${
                iconOnlyActions ? "shrink-0" : "w-full sm:ml-auto sm:w-auto"
              }`}
            >
              {manualOfflineMode && (
                <ActionButton
                  id={`${screenId}-offline-button`}
                  onClick={handleDownloadOffline}
                  disabled={isDownloadingOffline || products.length === 0}
                  aria-label="Save presentations for offline use"
                  label="Offline"
                  icon={<Download className={`w-5 h-5 ${isDownloadingOffline ? "animate-bounce" : ""}`} />}
                />
              )}
              <ActionButton
                id={`${screenId}-sync-button`}
                onClick={handleSync}
                disabled={isSyncing}
                aria-label={uiText.syncButton}
                label="Sync"
                icon={<RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />}
              />
              <ActionButton
                id={`${screenId}-logout-button`}
                onClick={handleLogout}
                aria-label={uiText.logoutButton}
                label="Logout"
                icon={<LogOut className="w-5 h-5" />}
              />
            </div>
          </div>

        </div>
      </header>

      <div id={`${screenId}-content`} className="max-w-screen-xl mx-auto px-4 mt-4 space-y-4">
        {/* Data Source Banner */}
        {dataSource !== 'live' && (
          <div id={`${screenId}-datasource-banner`} className={`p-3 rounded-lg border flex items-start gap-2 ${
            dataSource === 'cached' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
          }`}>
            <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              dataSource === 'cached' ? 'text-amber-600' : 'text-blue-600'
            }`} />
            <p id={`${screenId}-datasource-label`} className={`text-sm ${
              dataSource === 'cached' ? 'text-amber-700' : 'text-blue-700'
            }`}>
              {dataSource === 'cached' 
                ? 'Showing cached content. Sync to refresh.' 
                : 'Showing offline content. Connect to sync latest presentations.'}
            </p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div id={`${screenId}-error-banner`} className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p id={`${screenId}-error-label`} className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {manualOfflineMode && (offlineSummary.downloadedProducts > 0 || isDownloadingOffline) && (
          <div
            id={`${screenId}-offline-banner`}
            className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
            <p id={`${screenId}-offline-label`} className="text-sm text-emerald-700">
              {isDownloadingOffline
                ? "Saving presentations for offline use..."
                : `Offline library ready: ${offlineSummary.downloadedProducts} presentations, ${offlineSummary.downloadedDecks} validated cases, ${offlineSummary.cachedAssets} cached assets.`}
            </p>
          </div>
        )}

        {/* Search */}
        <div id={`${screenId}-search-wrap`} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            id={`${screenId}-search-input`}
            type="text"
            placeholder={uiText.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Category Filters */}
        <div id={`${screenId}-category-filters`} className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <FilterChip
              id={buildDomId(screenId, "filter", category)}
              key={category}
              label={category}
              active={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            />
          ))}
        </div>

        {/* Product Grid */}
        {filteredPresentations.length === 0 ? (
          <Card id={`${screenId}-empty-state`} className="p-8 text-center">
            <p id={`${screenId}-empty-title`} className="text-slate-500">No presentations found</p>
            {searchQuery && (
              <p id={`${screenId}-empty-hint`} className="text-sm text-slate-400 mt-2">
                Try adjusting your search or filter
              </p>
            )}
          </Card>
        ) : (
          <div id={`${screenId}-product-grid`} className={gridClassMap[settings.galleryColumns]}>
            {filteredPresentations.map((product) => (
              <Card
                id={buildDomId(screenId, "product-card", product._id)}
                key={product._id}
                onClick={() => navigate(`/case-selection/${product._id}`)}
                className="overflow-hidden"
              >
                <div id={buildDomId(screenId, "product-thumb-wrap", product._id)} className="aspect-video bg-slate-100 overflow-hidden">
                  <img
                    id={buildDomId(screenId, "product-thumb", product._id)}
                    src={product.thumbnail}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {settings.showGalleryLabels && (
                  <div id={buildDomId(screenId, "product-meta", product._id)} className="p-4">
                    <h3 id={buildDomId(screenId, "product-title", product._id)} className="font-semibold text-slate-900 mb-2">{product.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      {product.category && (
                        <Pill id={buildDomId(screenId, "product-category", product._id)} variant="muted">{product.category}</Pill>
                      )}
                      {manualOfflineMode && offlineProductIds.has(product._id) && (
                        <Pill id={buildDomId(screenId, "product-offline", product._id)} variant="success">Offline</Pill>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
