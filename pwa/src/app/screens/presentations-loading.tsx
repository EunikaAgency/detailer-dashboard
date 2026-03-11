import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { FilterChip } from "../components/ui/filter-chip";
import { ActionButton } from "../components/ui/action-button";
import { Grid, RefreshCw, LogOut, Search } from "lucide-react";
import { useAppSettings, type GalleryColumns } from "../lib/settings";

const CATEGORIES = ["All", "Cardiology", "Oncology", "Neurology", "Endocrinology", "General"];
const gridClassMap: Record<GalleryColumns, string> = {
  1: "grid grid-cols-1 gap-4",
  2: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2",
  3: "grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-3",
  4: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4",
};

export default function PresentationsLoading() {
  const settings = useAppSettings();

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader
        title="Presentations"
        showMenu
        icon={<Grid className="w-5 h-5 text-blue-500" />}
        rightActions={
          <>
            <ActionButton aria-label="Sync" label="Sync" icon={<RefreshCw className="w-5 h-5" />} disabled />
            <ActionButton aria-label="Logout" label="Logout" icon={<LogOut className="w-5 h-5" />} disabled />
          </>
        }
      />

      <div className="max-w-screen-xl mx-auto px-4 mt-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search presentations..."
            disabled
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg opacity-50"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((category, idx) => (
            <FilterChip
              key={category}
              label={category}
              active={idx === 0}
            />
          ))}
        </div>

        {/* Loading Skeleton Grid */}
        <div className={gridClassMap[settings.galleryColumns]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse relative flex items-center justify-center">
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-slate-600">
                    Fetching content from the internet...
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Please wait
                  </p>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
                <div className="h-6 bg-slate-100 rounded-full w-20 animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
