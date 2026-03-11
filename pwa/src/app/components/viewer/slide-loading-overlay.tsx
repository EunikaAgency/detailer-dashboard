/**
 * Slide Loading Overlay
 * Shows centered spinner while slide content loads
 */

export function SlideLoadingOverlay({ type, idPrefix }: { type: 'image' | 'video' | 'html'; idPrefix?: string }) {
  return (
    <div
      id={idPrefix ? `${idPrefix}-loading-overlay` : undefined}
      className="absolute inset-0 bg-white/90 flex items-center justify-center z-10"
    >
      <div id={idPrefix ? `${idPrefix}-loading-content` : undefined} className="text-center">
        <div
          id={idPrefix ? `${idPrefix}-loading-spinner` : undefined}
          className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"
        />
        <p id={idPrefix ? `${idPrefix}-loading-label` : undefined} className="text-sm text-slate-600">
          Loading slide...
        </p>
      </div>
    </div>
  );
}
