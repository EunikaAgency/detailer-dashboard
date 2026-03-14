import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { dismissAppUpdate, getAppUpdateState, initPWAInstall, refreshAppNow, subscribeAppUpdateState } from "../lib/pwa";
import { initSessionSync, trackAppLaunch } from "../lib/sessions";
import { useAppSettings } from "../lib/settings";
import { ActionButton } from "../components/ui/action-button";

const rootFontSizeMap = {
  compact: "14px",
  standard: "16px",
  comfortable: "18px",
} as const;

export default function RootLayout() {
  const settings = useAppSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [appUpdateState, setAppUpdateState] = useState(getAppUpdateState);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    trackAppLaunch();
    initPWAInstall();
    initSessionSync();
  }, []);

  useEffect(() => subscribeAppUpdateState(setAppUpdateState), []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.uiScale = settings.uiScale;
    document.documentElement.dataset.actionLabels = settings.actionLabels;
    document.documentElement.style.fontSize = rootFontSizeMap[settings.uiScale];
  }, [settings.actionLabels, settings.uiScale]);

  const isViewerRoute = location.pathname.includes("/viewer/");
  const showUpdateBanner = appUpdateState.updateAvailable && !isViewerRoute;

  return (
    <div data-ui-scale={settings.uiScale} data-action-labels={settings.actionLabels}>
      {!online && !isViewerRoute && (
        <div className="sticky top-0 z-[60] bg-amber-100 border-b border-amber-200 px-4 py-2">
          <div className="max-w-screen-xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-amber-900">
              Offline mode active. Downloaded decks remain available and repair tools are in Offline Support.
            </p>
            <ActionButton
              aria-label="Open offline support"
              label="Offline Support"
              onClick={() => navigate("/offline")}
              icon={<span className="text-sm">?</span>}
            />
          </div>
        </div>
      )}
      {showUpdateBanner && (
        <div className="sticky top-0 z-[70] bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-screen-xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-blue-900">
              Update available. Refresh when you are ready to load the latest viewer and offline fixes.
            </p>
            <div className="flex items-center gap-2">
              <ActionButton
                aria-label="Refresh app now"
                label={appUpdateState.refreshing ? "Refreshing..." : "Refresh now"}
                disabled={appUpdateState.refreshing}
                onClick={() => void refreshAppNow()}
                icon={<span className="text-sm">R</span>}
              />
              <ActionButton
                aria-label="Later"
                label="Later"
                onClick={dismissAppUpdate}
                icon={<span className="text-sm">L</span>}
              />
            </div>
          </div>
        </div>
      )}
      <Outlet />
    </div>
  );
}
