/**
 * HTML Slide Component
 * Renders HTML slides in sandboxed iframe with centering styles
 */

import { useState, useRef, useEffect } from 'react';
import { SlideLoadingOverlay } from './slide-loading-overlay';
import { SlideErrorOverlay } from './slide-error-overlay';
import { HotspotOverlay, type Hotspot } from './hotspot-overlay';

interface HtmlSlideProps {
  url: string;
  thumbnailUrl?: string;
  hotspots?: Hotspot[];
  title?: string;
  slideIndex?: number;
  totalSlides?: number;
  idPrefix?: string;
  onHotspotClick?: (targetIndex: number, hotspot: Hotspot) => void;
}

export function HtmlSlide({
  url,
  hotspots = [],
  title,
  slideIndex = 0,
  totalSlides = 0,
  idPrefix,
  onHotspotClick,
}: HtmlSlideProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16/9);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    // Reset states when URL changes
    setLoading(true);
    setError(false);
  }, [url]);
  
  const handleLoad = () => {
    setLoading(false);
    
    // Measure content and inject centering styles
    try {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (doc) {
        const width = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth);
        const height = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
        setAspectRatio(width / height || 16/9);
        
        // Inject centering styles to make content look embedded
        const style = doc.createElement('style');
        style.textContent = `
          html { height: 100%; }
          body {
            min-height: 100%;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            overflow: hidden;
          }
          body > * {
            max-width: 100%;
            max-height: 100%;
          }
        `;
        doc.head.appendChild(style);
      }
    } catch (e) {
      console.warn('Could not measure/style iframe content:', e);
    }
  };
  
  const handleError = () => {
    setLoading(false);
    setError(true);
  };
  
  return (
    <div
      id={idPrefix ? `${idPrefix}-root` : undefined}
      className="w-full h-full relative"
      style={{ aspectRatio }}
    >
      {loading && <SlideLoadingOverlay type="html" idPrefix={idPrefix} />}
      {error && <SlideErrorOverlay type="html" idPrefix={idPrefix} />}
      {hotspots.length > 0 && onHotspotClick && (
        <HotspotOverlay
          idPrefix={idPrefix}
          hotspots={hotspots}
          imageElement={null}
          frameElement={iframeRef.current}
          coordinateMode="fill"
          onHotspotClick={onHotspotClick}
        />
      )}
      <iframe
        ref={iframeRef}
        id={idPrefix ? `${idPrefix}-iframe` : "slide-html"}
        className="relative z-0 w-full h-full border-0"
        src={url}
        title={title || `Slide ${slideIndex + 1} of ${totalSlides}`}
        sandbox="allow-scripts allow-same-origin allow-forms"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
