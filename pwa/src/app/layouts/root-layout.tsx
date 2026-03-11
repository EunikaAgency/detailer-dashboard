import { useEffect } from "react";
import { Outlet } from "react-router";
import { initPWAInstall } from "../lib/pwa";
import { initSessionSync, trackAppLaunch } from "../lib/sessions";
import { useAppSettings } from "../lib/settings";

const rootFontSizeMap = {
  compact: "14px",
  standard: "16px",
  comfortable: "18px",
} as const;

export default function RootLayout() {
  const settings = useAppSettings();

  useEffect(() => {
    trackAppLaunch();
    initPWAInstall();
    initSessionSync();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.uiScale = settings.uiScale;
    document.documentElement.dataset.actionLabels = settings.actionLabels;
    document.documentElement.style.fontSize = rootFontSizeMap[settings.uiScale];
  }, [settings.actionLabels, settings.uiScale]);

  return (
    <div data-ui-scale={settings.uiScale} data-action-labels={settings.actionLabels}>
      <Outlet />
    </div>
  );
}
