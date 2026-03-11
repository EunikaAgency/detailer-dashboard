/**
 * Image Slide Component
 * Handles image loading, errors, zoom, and hotspots
 */

import { useState, useRef, useEffect } from 'react';
import { SlideLoadingOverlay } from './slide-loading-overlay';
import { SlideErrorOverlay } from './slide-error-overlay';
import { HotspotOverlay } from './hotspot-overlay';

interface ImageSlideProps {
  url: string;
  title?: string;
  hotspots?: any[];
  idPrefix?: string;
  onZoomToggle?: (zoomed: boolean) => void;
  onHotspotClick?: (targetIndex: number, hotspot: any) => void;
}

export function ImageSlide({ url, title, hotspots, idPrefix, onZoomToggle, onHotspotClick }: ImageSlideProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const syncImageState = () => {
    const image = imageRef.current;
    if (!image || !image.complete) {
      return;
    }

    setLoading(false);
    setError(image.naturalWidth === 0);
  };
  
  useEffect(() => {
    // Reset states when slide changes
    setLoading(true);
    setError(false);
    setZoomed(false);
    syncImageState();
  }, [url]);
  
  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };
  
  const handleError = () => {
    setLoading(false);
    setError(true);
  };
  
  const handleDoubleClick = () => {
    const newZoomed = !zoomed;
    setZoomed(newZoomed);
    onZoomToggle?.(newZoomed);
  };
  
  return (
    <div id={idPrefix ? `${idPrefix}-root` : undefined} className="w-full h-full relative">
      {loading && <SlideLoadingOverlay type="image" idPrefix={idPrefix} />}
      {error && <SlideErrorOverlay type="image" idPrefix={idPrefix} />}
      
      {!error && (
        <>
          <img
            id={idPrefix ? `${idPrefix}-image` : undefined}
            ref={imageRef}
            src={url}
            alt={title || 'Slide'}
            className={`w-full h-full object-contain transition-transform duration-300 ${
              zoomed ? 'scale-200 cursor-zoom-out' : 'cursor-zoom-in'
            }`}
            style={{
              transform: zoomed ? 'scale(2)' : 'scale(1)',
            }}
            onLoad={handleLoad}
            onError={handleError}
            onDoubleClick={handleDoubleClick}
          />
          
          {/* Hotspot Overlay */}
          {!zoomed && hotspots && hotspots.length > 0 && (
            <HotspotOverlay
              idPrefix={idPrefix}
              hotspots={hotspots}
              imageElement={imageRef.current}
              onHotspotClick={onHotspotClick}
            />
          )}
        </>
      )}
    </div>
  );
}
