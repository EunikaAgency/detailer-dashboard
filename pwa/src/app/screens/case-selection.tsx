import { useNavigate, useParams } from "react-router";
import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { Clock, Download, CheckCircle2, LayoutTemplate } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getLocallyAvailableProducts,
  getProductById,
  getProductDecks,
  getRenderableSlides,
  estimateDuration,
  getDeckTitle,
} from "../lib/products";
import { trackEvent } from "../lib/sessions";
import { buildDomId } from "../lib/dom-ids";
import {
  cacheProductForOffline,
  estimateOfflineDownloadNeed,
  getOfflinePresentationRecord,
  repairOfflinePresentation,
  verifyOfflinePresentation,
  type OfflinePresentationRecord,
} from "../lib/media-cache";
import { useAppSettings } from "../lib/settings";

export default function CaseSelection() {
  const navigate = useNavigate();
  const { presentationId } = useParams();
  const screenId = "case-selection";
  const [product, setProduct] = useState<any>(null);
  const [decks, setDecks] = useState<any[]>([]);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [offlineRecord, setOfflineRecord] = useState<OfflinePresentationRecord | null>(null);
  const settings = useAppSettings();
  const manualOfflineMode = settings.offlineAccessMode === "manual";

  useEffect(() => {
    trackEvent('activity', 'screen_view', 'case-selection', { presentationId });

    if (!presentationId) {
      navigate("/presentations");
      return;
    }

    // Get product from cached products
    const products = getLocallyAvailableProducts();
    const foundProduct = getProductById(presentationId, products);

    if (!foundProduct) {
      navigate("/presentations");
      return;
    }

    setProduct(foundProduct);
    const currentProductId = foundProduct._id || foundProduct.id || "";
    const existingRecord = getOfflinePresentationRecord(currentProductId);
    setOfflineRecord(existingRecord);
    if (existingRecord) {
      void verifyOfflinePresentation(foundProduct).then(setOfflineRecord);
    }
    
    // Get decks/cases from product
    const productDecks = getProductDecks(foundProduct);
    const decksWithSlides = productDecks.map((deck, groupIndex) => {
      const slides = getRenderableSlides(deck.items || deck.slides || []);
      return {
        id: deck.groupId,
        title: getDeckTitle(deck, groupIndex),
        slides: slides.length,
        duration: estimateDuration(slides.length),
        items: deck.items || deck.slides || [],
      };
    }).filter(deck => deck.slides > 0); // Only show decks with renderable slides

    setDecks(decksWithSlides);
  }, [presentationId, navigate]);

  useEffect(() => {
    if (!product || settings.offlineAccessMode !== "automatic" || !navigator.onLine) {
      return;
    }

    void estimateOfflineDownloadNeed(product).then((estimate) => {
      if (estimate.lowHeadroom) {
        return;
      }
      return cacheProductForOffline(product).then(() => {
        setOfflineRecord(getOfflinePresentationRecord(product._id || product.id || ""));
      });
    });
  }, [product, settings.offlineAccessMode]);

  const handleSaveOffline = async () => {
    if (!product) {
      return;
    }

    const estimate = await estimateOfflineDownloadNeed(product);
    if (
      estimate.lowHeadroom &&
      !window.confirm("Storage is running low. Continue downloading this presentation for offline use?")
    ) {
      return;
    }

    setIsSavingOffline(true);

    try {
      const result = await repairOfflinePresentation(product);
      setOfflineRecord(getOfflinePresentationRecord(product._id || product.id || ""));
      window.alert(
        `Presentation saved for offline use.\nStatus: ${result.status}.\nCached ${result.cached} assets for ${product.name}.`
      );
    } catch (error) {
      console.error("Failed to cache presentation:", error);
      window.alert("Failed to save this presentation for offline use.");
    } finally {
      setIsSavingOffline(false);
    }
  };

  if (!product) {
    return (
      <div id={`${screenId}-loading`} className="min-h-screen pb-6 bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <StickyHeader
          idPrefix={screenId}
          title="Loading..."
          showMenu
        />
      </div>
    );
  }

  return (
    <div id={`${screenId}-root`} className="min-h-screen pb-6 bg-gradient-to-br from-blue-50 via-white to-slate-50">
      <StickyHeader
        idPrefix={screenId}
        title={product.name}
        showBack
        backTo="/presentations"
      />

      <div id={`${screenId}-content`} className="max-w-2xl mx-auto px-4 mt-5 sm:mt-8">
        <h2 id={`${screenId}-heading`} className="text-xl font-semibold text-slate-900 mb-5 sm:mb-6">Select Case</h2>

        {manualOfflineMode && (
          <Card id={`${screenId}-offline-card`} className="p-4 mb-6 border border-emerald-200 bg-emerald-50/60">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-emerald-900">Offline Access</div>
                <div className="text-sm text-emerald-700 mt-1">
                  {offlineRecord
                    ? `Status: ${offlineRecord.status}. ${offlineRecord.assetCount} cached assets across ${offlineRecord.deckIds.length} cases.`
                    : "Download this presentation now so its decks, slides, and media remain available offline."}
                </div>
              </div>

              <ActionButton
                id={`${screenId}-offline-save-button`}
                onClick={handleSaveOffline}
                disabled={isSavingOffline}
                label={offlineRecord ? "Refresh Offline" : "Save Offline"}
                aria-label="Save presentation for offline use"
                icon={
                  offlineRecord ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Download className={`w-5 h-5 ${isSavingOffline ? "animate-bounce" : ""}`} />
                  )
                }
              />
            </div>
          </Card>
        )}

        {decks.length === 0 ? (
          <Card id={`${screenId}-empty-state`} className="p-8 text-center">
            <p id={`${screenId}-empty-title`} className="text-slate-500">No cases available</p>
            <p id={`${screenId}-empty-label`} className="text-sm text-slate-400 mt-2">
              This presentation does not have any renderable content
            </p>
            <button
              id={`${screenId}-empty-back-button`}
              onClick={() => navigate("/presentations")}
              className="mt-4 text-blue-500 hover:text-blue-600 font-medium"
            >
              Back to Presentations
            </button>
          </Card>
        ) : (
          <div id={`${screenId}-deck-list`} className="space-y-3">
            {decks.map((deck, index) => (
              <Card
                id={buildDomId(screenId, "deck-card", index + 1)}
                key={deck.id}
                onClick={() => {
                  trackEvent('activity', 'case_selected', 'case-selection', { 
                    presentationId, 
                    caseId: deck.id 
                  });
                  navigate(`/viewer/${presentationId}/${deck.id}`);
                }}
                className="p-4 sm:p-5"
              >
                <div id={buildDomId(screenId, "deck-card-content", index + 1)} className="flex items-start gap-3 sm:gap-4">
                  <div id={buildDomId(screenId, "deck-card-icon", index + 1)} className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                    <LayoutTemplate className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div id={buildDomId(screenId, "deck-card-meta", index + 1)} className="flex-1 min-w-0">
                    <h3
                      id={buildDomId(screenId, "deck-card-title", index + 1)}
                      className="font-semibold text-slate-900 text-lg leading-tight sm:leading-snug mb-2 break-words"
                    >
                      {deck.title}
                    </h3>
                    <div
                      id={buildDomId(screenId, "deck-card-stats", index + 1)}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600"
                    >
                      <span id={buildDomId(screenId, "deck-card-slide-count", index + 1)}>{deck.slides} slides</span>
                      <span id={buildDomId(screenId, "deck-card-separator", index + 1)} className="text-slate-400">•</span>
                      <div id={buildDomId(screenId, "deck-card-duration", index + 1)} className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span id={buildDomId(screenId, "deck-card-duration-label", index + 1)}>{deck.duration}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
