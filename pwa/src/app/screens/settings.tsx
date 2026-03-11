import { useNavigate } from "react-router";
import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { SegmentedControl } from "../components/ui/segmented-control";
import { ChevronRight } from "lucide-react";
import { useEffect } from "react";
import {
  useAppSettings,
  updateSettings,
  type AppSettings,
  type ActionLabels,
  type GalleryColumns,
  type UiScale,
} from "../lib/settings";
import { trackEvent } from "../lib/sessions";

export default function Settings() {
  const navigate = useNavigate();
  const screenId = "settings";
  const settings = useAppSettings();

  useEffect(() => {
    trackEvent("activity", "screen_view", "settings");
  }, []);

  const handleToggle = (key: keyof AppSettings, value: boolean) => {
    updateSettings({ [key]: value } as Partial<AppSettings>);
  };

  const handleSelect = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    updateSettings({ [key]: value } as Partial<AppSettings>);
  };

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader title="Settings" showBack backTo="/menu" />

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {/* Appearance Settings */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 px-1">Appearance</h2>
          
          <Card id={`${screenId}-appearance-card`} className="divide-y divide-slate-200">
            {/* Actions */}
            <div className="p-4">
              <div className="font-medium text-slate-900 mb-1">Buttons and navigation</div>
              <div className="text-sm text-slate-500 mb-3">
                Choose whether navigation and action buttons use icons only or visible labels.
              </div>
              <SegmentedControl
                options={[
                  { value: "labels", label: "Labels" },
                  { value: "icons", label: "Icons" },
                ]}
                value={settings.actionLabels}
                onChange={(value) => handleSelect("actionLabels", value as ActionLabels)}
              />
            </div>

            {/* Show Gallery Labels */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">Show gallery labels</div>
                <div className="text-sm text-slate-500">Display title and category on cards</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showGalleryLabels}
                  onChange={(e) => handleToggle('showGalleryLabels', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

            {/* Gallery Columns */}
            <div className="p-4">
              <div className="font-medium text-slate-900 mb-3">Gallery columns</div>
              <SegmentedControl
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                  { value: "4", label: "4" },
                ]}
                value={String(settings.galleryColumns)}
                onChange={(value) => handleSelect("galleryColumns", Number(value) as GalleryColumns)}
              />
            </div>

            {/* UI Scale */}
            <div className="p-4">
              <div className="font-medium text-slate-900 mb-3">UI scale</div>
              <SegmentedControl
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "standard", label: "Standard" },
                  { value: "comfortable", label: "Comfortable" },
                ]}
                value={settings.uiScale}
                onChange={(value) => handleSelect("uiScale", value as UiScale)}
              />
            </div>
          </Card>
        </div>

        {/* Presentation Settings */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 px-1">Presentation</h2>
          
          <Card id={`${screenId}-presentation-card`} className="divide-y divide-slate-200">
            {/* Dynamic Slide Backdrop */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">Dynamic slide backdrop</div>
                <div className="text-sm text-slate-500">Use current slide as background</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.dynamicSlideBackdrop}
                  onChange={(e) => handleToggle('dynamicSlideBackdrop', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </Card>
        </div>

        {/* Advanced Settings Link */}
        <Card
          id={`${screenId}-advanced-card`}
          onClick={() => navigate("/settings/advanced")}
          className="p-4 flex items-center justify-between"
        >
          <div>
            <div className="font-medium text-slate-900">Advanced</div>
            <div className="text-sm text-slate-500">Debug, diagnostics, and cache management</div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </Card>
      </div>
    </div>
  );
}
