/**
 * Video Slide Component
 * Handles video loading and errors
 */

import { useState, useEffect } from 'react';
import { SlideLoadingOverlay } from './slide-loading-overlay';
import { SlideErrorOverlay } from './slide-error-overlay';

interface VideoSlideProps {
  url: string;
  title?: string;
  slideIndex?: number;
  idPrefix?: string;
}

export function VideoSlide({ url, title, slideIndex = 0, idPrefix }: VideoSlideProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    // Reset states when URL changes
    setLoading(true);
    setError(false);
  }, [url]);
  
  const handleLoadedData = () => {
    setLoading(false);
  };
  
  const handleError = () => {
    setLoading(false);
    setError(true);
  };
  
  return (
    <div id={idPrefix ? `${idPrefix}-root` : undefined} className="w-full h-full relative">
      {loading && <SlideLoadingOverlay type="video" idPrefix={idPrefix} />}
      {error && <SlideErrorOverlay type="video" idPrefix={idPrefix} />}
      
      {!error && (
        <video
          id={idPrefix ? `${idPrefix}-video` : undefined}
          src={url}
          controls
          className="w-full h-full object-contain"
          onLoadedData={handleLoadedData}
          onError={handleError}
        />
      )}
    </div>
  );
}
