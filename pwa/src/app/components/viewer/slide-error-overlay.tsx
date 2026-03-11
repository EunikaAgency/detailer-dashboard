/**
 * Slide Error Overlay
 * Shows error message when slide fails to load
 */

export function SlideErrorOverlay({ type, idPrefix }: { type: 'image' | 'video' | 'html'; idPrefix?: string }) {
  const message = type === 'image' ? 'Image unavailable' :
                  type === 'video' ? 'Video unavailable' :
                  'Slide unavailable';
  
  return (
    <div
      id={idPrefix ? `${idPrefix}-error-overlay` : undefined}
      className="absolute inset-0 bg-slate-50 flex items-center justify-center"
    >
      <div id={idPrefix ? `${idPrefix}-error-content` : undefined} className="text-center">
        <p id={idPrefix ? `${idPrefix}-error-label` : undefined} className="text-slate-500">
          {message}
        </p>
      </div>
    </div>
  );
}
