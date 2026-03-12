/**
 * Hotspot Overlay Component
 * Renders interactive regions on image slides
 */

import { useEffect, useState, useRef } from "react";
import { getSetting } from "../../lib/settings";

export interface Hotspot {
  id?: string;
  x: number;  // normalized 0-1
  y: number;  // normalized 0-1
  w: number;  // normalized 0-1
  h: number;  // normalized 0-1
  shape?: string;
  targetIndex: number;
}

interface HotspotOverlayProps {
  idPrefix?: string;
  hotspots: Hotspot[];
  imageElement: HTMLImageElement | null;
  frameElement?: HTMLElement | null;
  coordinateMode?: "contain" | "fill";
  onHotspotClick: (targetIndex: number, hotspot: Hotspot) => void;
}

export function HotspotOverlay({
  idPrefix,
  hotspots,
  imageElement,
  frameElement = null,
  coordinateMode = "contain",
  onHotspotClick,
}: HotspotOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageBounds, setImageBounds] = useState<DOMRect | null>(null);
  const [showAreas, setShowAreas] = useState(getSetting('showHotspotAreas'));

  // Calculate actual image bounds considering object-fit: contain
  useEffect(() => {
    if (!containerRef.current) {
      setImageBounds(null);
      return;
    }

    const updateBounds = () => {
      const container = containerRef.current;
      if (!container) return;

      if (coordinateMode === "fill") {
        const containerRect = container.getBoundingClientRect();
        const referenceRect = frameElement?.getBoundingClientRect();
        const left = referenceRect ? referenceRect.left - containerRect.left : 0;
        const top = referenceRect ? referenceRect.top - containerRect.top : 0;
        const width = referenceRect?.width || containerRect.width;
        const height = referenceRect?.height || containerRect.height;

        setImageBounds({
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          x: left,
          y: top,
          toJSON: () => ({}),
        } as DOMRect);
        return;
      }

      if (!imageElement) {
        setImageBounds(null);
        return;
      }

      // Measure the rendered image box and derive the painted area for object-fit: contain.
      const imageRect = imageElement.getBoundingClientRect();
      const naturalWidth = imageElement.naturalWidth;
      const naturalHeight = imageElement.naturalHeight;
      const containerRect = container.getBoundingClientRect();

      if (!naturalWidth || !naturalHeight || !imageRect.width || !imageRect.height) {
        setImageBounds(null);
        return;
      }

      const scale = Math.min(
        imageRect.width / naturalWidth,
        imageRect.height / naturalHeight
      );
      const renderedWidth = naturalWidth * scale;
      const renderedHeight = naturalHeight * scale;
      const offsetX = imageRect.left - containerRect.left + ((imageRect.width - renderedWidth) / 2);
      const offsetY = imageRect.top - containerRect.top + ((imageRect.height - renderedHeight) / 2);

      setImageBounds({
        left: offsetX,
        top: offsetY,
        width: renderedWidth,
        height: renderedHeight,
        right: offsetX + renderedWidth,
        bottom: offsetY + renderedHeight,
        x: offsetX,
        y: offsetY,
        toJSON: () => ({}),
      } as DOMRect);
    };

    // Initial calculation
    updateBounds();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(containerRef.current);
    if (frameElement) {
      resizeObserver.observe(frameElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [coordinateMode, frameElement, imageElement]);

  // Listen for settings changes
  useEffect(() => {
    const interval = setInterval(() => {
      setShowAreas(getSetting('showHotspotAreas'));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  if (!imageBounds || hotspots.length === 0) {
    return (
      <div
        id={idPrefix ? `${idPrefix}-hotspots-empty` : undefined}
        ref={containerRef}
        className="absolute inset-0 z-10 pointer-events-none"
      />
    );
  }

  return (
    <div
      id={idPrefix ? `${idPrefix}-hotspots` : undefined}
      ref={containerRef}
      className="absolute inset-0 z-10 pointer-events-none"
    >
      {hotspots.map((hotspot, index) => {
        // Calculate pixel positions from normalized coordinates
        const left = imageBounds.left + (hotspot.x * imageBounds.width);
        const top = imageBounds.top + (hotspot.y * imageBounds.height);
        const width = hotspot.w * imageBounds.width;
        const height = hotspot.h * imageBounds.height;

        return (
          <button
            id={idPrefix ? `${idPrefix}-hotspot-${index + 1}` : undefined}
            key={hotspot.id || `hotspot-${index}`}
            onClick={() => onHotspotClick(hotspot.targetIndex, hotspot)}
            className={`absolute box-border pointer-events-auto cursor-pointer transition-colors ${
              showAreas
                ? 'bg-blue-500/20 border-2 border-blue-500 hover:bg-blue-500/30'
                : 'bg-transparent hover:bg-blue-500/10'
            }`}
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
            }}
            aria-label={`Navigate to slide ${hotspot.targetIndex + 1}`}
          />
        );
      })}
    </div>
  );
}
