import { useEffect, useState } from "react";
import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { ActionButton } from "../components/ui/action-button";
import { clearMediaCache, clearPresentationCache, getOfflinePresentationSummary, getStorageEstimateSnapshot } from "../lib/media-cache";
import { getSessionSyncDiagnostics } from "../lib/sessions";

export default function OfflineSupport() {
  const screenId = "offline-support";
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [offlineSummary, setOfflineSummary] = useState(() => getOfflinePresentationSummary());
  const [storageEstimate, setStorageEstimate] = useState<Awaited<ReturnType<typeof getStorageEstimateSnapshot>>>(null);
  const [syncDiagnostics, setSyncDiagnostics] = useState<{ queueSize: number; lastSyncResult: any } | null>(null);

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      setOfflineSummary(getOfflinePresentationSummary());
      void getStorageEstimateSnapshot().then(setStorageEstimate);
      void getSessionSyncDiagnostics().then(setSyncDiagnostics);
    };

    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  const handleRepairCaches = async () => {
    await clearMediaCache();
    await clearPresentationCache();
    setOfflineSummary(getOfflinePresentationSummary());
    void getStorageEstimateSnapshot().then(setStorageEstimate);
  };

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader title="Offline Support" showBack backTo="/presentations" />

      <div className="max-w-3xl mx-auto px-4 mt-6 space-y-4">
        <Card id={`${screenId}-connectivity-card`} className="p-5">
          <div className="text-lg font-semibold text-slate-900">Connectivity</div>
          <p className={`mt-2 text-sm ${online ? "text-green-700" : "text-amber-700"}`}>
            {online ? "Online. Sync and repair actions are available." : "Offline. Only downloaded and verified decks are expected to work."}
          </p>
        </Card>

        <Card id={`${screenId}-library-card`} className="p-5">
          <div className="text-lg font-semibold text-slate-900">Offline Library</div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div>{offlineSummary.downloadedProducts} ready presentations</div>
            <div>{offlineSummary.downloadedDecks} validated decks</div>
            <div>{offlineSummary.incompleteDecks} incomplete decks</div>
            <div>{offlineSummary.corruptedDecks} corrupted decks</div>
            <div>{offlineSummary.needsUpdateDecks} decks needing update</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton
              aria-label="Clear offline media"
              label="Clear Offline Media"
              onClick={() => void clearMediaCache().then(() => setOfflineSummary(getOfflinePresentationSummary()))}
              icon={<span className="text-sm">C</span>}
            />
            <ActionButton
              aria-label="Reset deck caches"
              label="Reset Deck Caches"
              onClick={() => void handleRepairCaches()}
              icon={<span className="text-sm">R</span>}
            />
            <ActionButton
              aria-label="Retry connection"
              label="Retry"
              onClick={() => window.location.reload()}
              icon={<span className="text-sm">T</span>}
            />
          </div>
        </Card>

        <Card id={`${screenId}-storage-card`} className="p-5">
          <div className="text-lg font-semibold text-slate-900">Storage</div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div>Quota: {storageEstimate?.quota ? `${Math.round(storageEstimate.quota / 1024 / 1024)} MB` : "Unavailable"}</div>
            <div>Usage: {storageEstimate?.usage ? `${Math.round(storageEstimate.usage / 1024 / 1024)} MB` : "Unavailable"}</div>
            <div>Free headroom: {storageEstimate?.available ? `${Math.round(storageEstimate.available / 1024 / 1024)} MB` : "Unavailable"}</div>
          </div>
        </Card>

        <Card id={`${screenId}-session-sync-card`} className="p-5">
          <div className="text-lg font-semibold text-slate-900">Session Sync</div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div>Queued events: {syncDiagnostics?.queueSize ?? "Unavailable"}</div>
            <div>
              Last sync: {syncDiagnostics?.lastSyncResult?.syncedAt ? new Date(syncDiagnostics.lastSyncResult.syncedAt).toLocaleString() : "No sync recorded"}
            </div>
            <div>Last sync error: {syncDiagnostics?.lastSyncResult?.error || "None"}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
