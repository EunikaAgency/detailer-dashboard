/**
 * Thumbnail Component
 * Handles thumbnail loading, error states, and HTML placeholder
 */

import { useEffect, useRef, useState } from 'react';
import type { NormalizedSlide } from '../../lib/products';

interface ThumbnailProps {
  slide: NormalizedSlide;
  index: number;
  currentSlide: number;
  goToSlide: (index: number) => void;
  idPrefix?: string;
}

export function Thumbnail({ slide, index, currentSlide, goToSlide, idPrefix }: ThumbnailProps) {
  const [loading, setLoading] = useState(!!slide.thumbnailUrl);
  const [error, setError] = useState(false);
  const isActive = currentSlide === index;
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoading(!!slide.thumbnailUrl);
    setError(false);

    const image = imageRef.current;
    if (!image || !image.complete) {
      return;
    }

    setLoading(false);
    setError(image.naturalWidth === 0);
  }, [slide.thumbnailUrl]);
  
  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };
  
  const handleError = () => {
    setLoading(false);
    setError(true);
  };
  
  return (
    <button
      id={idPrefix ? `${idPrefix}-button` : undefined}
      data-active={isActive ? "true" : "false"}
      onClick={() => goToSlide(index)}
      className={`group flex-shrink-0 w-40 sm:w-44 lg:w-full aspect-[16/9] rounded-lg overflow-hidden border-2 transition-all ${
        isActive
          ? "border-blue-500 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20"
          : "border-slate-700/70 hover:border-slate-500"
      }`}
    >
      {/* Image/Video thumbnail with preview */}
      {slide.thumbnailUrl && !error && (
        <div id={idPrefix ? `${idPrefix}-preview` : undefined} className="w-full h-full relative">
          {loading && (
            <div
              id={idPrefix ? `${idPrefix}-loading` : undefined}
              className="absolute inset-0 bg-slate-700 flex items-center justify-center"
            >
              <div
                id={idPrefix ? `${idPrefix}-loading-spinner` : undefined}
                className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"
              />
            </div>
          )}
          <img
            id={idPrefix ? `${idPrefix}-image` : undefined}
            ref={imageRef}
            src={slide.thumbnailUrl}
            alt={`Slide ${index + 1}`}
            className={`w-full h-full object-cover transition-all duration-200 ${
              isActive
                ? "opacity-100 saturate-100 brightness-100 scale-100"
                : "opacity-45 saturate-[0.2] brightness-[0.8] group-hover:opacity-70 group-hover:saturate-[0.5]"
            }`}
            onLoad={handleLoad}
            onError={handleError}
          />
          {!isActive && (
            <div
              id={idPrefix ? `${idPrefix}-inactive-overlay` : undefined}
              className="absolute inset-0 bg-slate-950/25 transition-opacity duration-200 group-hover:opacity-40"
            />
          )}
        </div>
      )}
      
      {/* HTML thumbnail with preview error or no preview - show placeholder */}
      {slide.type === 'html' && (!slide.thumbnailUrl || error) && (
        <div
          id={idPrefix ? `${idPrefix}-html-fallback` : undefined}
          className={`w-full h-full flex items-center justify-center transition-all ${
            isActive ? "bg-slate-700" : "bg-slate-800 text-opacity-60"
          }`}
        >
          <span id={idPrefix ? `${idPrefix}-html-label` : undefined} className="text-sm font-medium text-slate-400">
            HTML
          </span>
        </div>
      )}
      
      {/* Video placeholder */}
      {slide.type === 'video' && !slide.thumbnailUrl && (
        <div
          id={idPrefix ? `${idPrefix}-video-fallback` : undefined}
          className={`w-full h-full flex items-center justify-center transition-all ${
            isActive ? "bg-slate-700" : "bg-slate-800"
          }`}
        >
          <span id={idPrefix ? `${idPrefix}-video-label` : undefined} className="text-xs text-slate-400">
            Video
          </span>
        </div>
      )}
      
      {/* Image error state */}
      {slide.type === 'image' && error && (
        <div
          id={idPrefix ? `${idPrefix}-image-fallback` : undefined}
          className={`w-full h-full flex items-center justify-center transition-all ${
            isActive ? "bg-slate-700" : "bg-slate-800"
          }`}
        >
          <span id={idPrefix ? `${idPrefix}-image-label` : undefined} className="text-xs text-slate-400">
            No preview
          </span>
        </div>
      )}
    </button>
  );
}
