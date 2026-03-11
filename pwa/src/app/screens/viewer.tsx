import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { Menu, Home, ArrowLeft, Maximize2, ChevronLeft, ChevronRight, Smartphone, Monitor, Maximize, PanelRightClose, PanelRightOpen } from "lucide-react";
import { getLocallyAvailableProducts, getProductById, normalizeSlides, type NormalizedSlide } from "../lib/products";
import { trackEvent } from "../lib/sessions";
import { useAppSettings } from "../lib/settings";
import { buildDomId } from "../lib/dom-ids";
import { ImageSlide } from "../components/viewer/image-slide";
import { VideoSlide } from "../components/viewer/video-slide";
import { HtmlSlide } from "../components/viewer/html-slide";
import { Thumbnail } from "../components/viewer/thumbnail";
import { ActionButton } from "../components/ui/action-button";

type OrientationMode = 'auto' | 'portrait' | 'landscape';

const NAVIGATION_FADE_DELAY_MS = 1800;
const SWIPE_THRESHOLD_PX = 48;
const SWIPE_VERTICAL_TOLERANCE_PX = 72;

export default function Viewer() {
  const navigate = useNavigate();
  const { presentationId, caseId } = useParams();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [orientationMode, setOrientationMode] = useState<OrientationMode>('auto');
  const [slides, setSlides] = useState<NormalizedSlide[]>([]);
  const [deckTitle, setDeckTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showNavButtons, setShowNavButtons] = useState(true);
  const [isCompactLandscape, setIsCompactLandscape] = useState(false);
  const settings = useAppSettings();
  const hideNavButtonsTimeoutRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const slideTransitionDirectionRef = useRef<'forward' | 'backward'>('forward');
  const slideContentRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRailRef = useRef<HTMLDivElement | null>(null);

  // Get settings
  const dynamicBackdrop = settings.dynamicSlideBackdrop;

  // Load slides from product data
  useEffect(() => {
    trackEvent('activity', 'screen_view', 'presentation', { 
      presentationId, 
      caseId 
    });

    if (!presentationId || !caseId) {
      navigate("/presentations");
      return;
    }

    const products = getLocallyAvailableProducts();
    const product = getProductById(presentationId, products);

    if (!product) {
      navigate("/presentations");
      return;
    }
    // Find the deck/case
    const deck = product.media?.find(m => m.groupId === caseId);

    if (!deck) {
      navigate(`/case-selection/${presentationId}`);
      return;
    }

    setDeckTitle(deck.title || "");

    // Normalize slides with hotspot resolution
    const normalizedSlides = normalizeSlides(deck.items || []);
    
    // Filter to renderable slides only
    const renderableSlides = normalizedSlides.filter(slide => 
      ['image', 'video', 'html'].includes(slide.type)
    );

    setSlides(renderableSlides);
    setIsLoading(false);
  }, [presentationId, caseId, navigate]);

  useEffect(() => {
    const updateCompactLandscape = () => {
      if (typeof window === "undefined") {
        setIsCompactLandscape(false);
        return;
      }

      setIsCompactLandscape(window.innerWidth > window.innerHeight && window.innerHeight <= 500);
    };

    updateCompactLandscape();
    window.addEventListener("resize", updateCompactLandscape);

    return () => {
      window.removeEventListener("resize", updateCompactLandscape);
    };
  }, []);

  useEffect(() => {
    const scheduleFade = () => {
      if (hideNavButtonsTimeoutRef.current !== null) {
        window.clearTimeout(hideNavButtonsTimeoutRef.current);
      }

      setShowNavButtons(true);
      hideNavButtonsTimeoutRef.current = window.setTimeout(() => {
        setShowNavButtons(false);
      }, NAVIGATION_FADE_DELAY_MS);
    };

    scheduleFade();

    return () => {
      if (hideNavButtonsTimeoutRef.current !== null) {
        window.clearTimeout(hideNavButtonsTimeoutRef.current);
      }
    };
  }, [currentSlide]);

  useEffect(() => {
    const slideContent = slideContentRef.current;
    if (!slideContent || typeof slideContent.animate !== 'function') {
      return;
    }

    const fromX = slideTransitionDirectionRef.current === 'forward' ? 36 : -36;
    const animation = slideContent.animate(
      [
        {
          opacity: 0.5,
          transform: `translate3d(${fromX}px, 0, 0) scale(0.985)`,
        },
        {
          opacity: 1,
          transform: 'translate3d(0, 0, 0) scale(1)',
        },
      ],
      {
        duration: 260,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both',
      }
    );

    return () => {
      animation.cancel();
    };
  }, [currentSlide]);

  useEffect(() => {
    if (!showThumbnails) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const activeThumbnail = thumbnailRailRef.current?.querySelector<HTMLElement>('[data-active="true"]');
      activeThumbnail?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentSlide, showThumbnails]);

  const totalSlides = slides.length;
  const viewerId = "viewer";

  const revealNavigationButtons = () => {
    if (hideNavButtonsTimeoutRef.current !== null) {
      window.clearTimeout(hideNavButtonsTimeoutRef.current);
    }

    setShowNavButtons(true);
    hideNavButtonsTimeoutRef.current = window.setTimeout(() => {
      setShowNavButtons(false);
    }, NAVIGATION_FADE_DELAY_MS);
  };

  const goToNextSlide = () => {
    revealNavigationButtons();
    if (currentSlide < totalSlides - 1) {
      const newIndex = currentSlide + 1;
      slideTransitionDirectionRef.current = 'forward';
      setCurrentSlide(newIndex);
      trackEvent('activity', 'slide_changed', 'presentation', {
        deckId: caseId,
        fromIndex: currentSlide,
        toIndex: newIndex,
      });
    }
  };

  const goToPreviousSlide = () => {
    revealNavigationButtons();
    if (currentSlide > 0) {
      const newIndex = currentSlide - 1;
      slideTransitionDirectionRef.current = 'backward';
      setCurrentSlide(newIndex);
      trackEvent('activity', 'slide_changed', 'presentation', {
        deckId: caseId,
        fromIndex: currentSlide,
        toIndex: newIndex,
      });
    }
  };

  const goToSlide = (index: number) => {
    revealNavigationButtons();
    if (index !== currentSlide) {
      slideTransitionDirectionRef.current = index > currentSlide ? 'forward' : 'backward';
      trackEvent('activity', 'slide_changed', 'presentation', {
        deckId: caseId,
        fromIndex: currentSlide,
        toIndex: index,
      });
      setCurrentSlide(index);
    }
  };

  const handleHotspotClick = (targetIndex: number, hotspot: any) => {
    revealNavigationButtons();
    slideTransitionDirectionRef.current = targetIndex > currentSlide ? 'forward' : 'backward';
    trackEvent('activity', 'hotspot_tapped', 'presentation', {
      deckId: caseId,
      fromIndex: currentSlide,
      toIndex: targetIndex,
      hotspotId: hotspot.id,
    });
    setCurrentSlide(targetIndex);
  };

  const handleZoomToggle = (zoomed: boolean) => {
    trackEvent('activity', 'image_zoom_toggled', 'presentation', {
      zoomed,
      slideIndex: currentSlide
    });
  };

  const toggleFullscreen = () => {
    const newState = !isFullscreen;
    setIsFullscreen(newState);
    trackEvent('activity', 'fullscreen_toggled', 'presentation', {
      fullscreen: newState
    });
  };

  const toggleThumbnails = () => {
    const newState = !showThumbnails;
    setShowThumbnails(newState);
    trackEvent('activity', 'thumbnails_toggled', 'presentation', {
      visible: newState
    });
  };

  const handleOrientationChange = (mode: OrientationMode) => {
    revealNavigationButtons();
    setOrientationMode(mode);
    trackEvent('activity', 'orientation_changed', 'presentation', {
      mode
    });

    // Attempt orientation lock (mobile browsers)
    if (mode === 'portrait' && screen.orientation?.lock) {
      screen.orientation.lock('portrait').catch(() => {});
    } else if (mode === 'landscape' && screen.orientation?.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    } else if (mode === 'auto' && screen.orientation?.unlock) {
      screen.orientation.unlock();
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
    revealNavigationButtons();
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    const touchStart = touchStartRef.current;
    touchStartRef.current = null;

    if (!touch || !touchStart) {
      return;
    }

    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    revealNavigationButtons();

    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaY) > SWIPE_VERTICAL_TOLERANCE_PX
    ) {
      return;
    }

    if (deltaX < 0) {
      goToNextSlide();
      return;
    }

    goToPreviousSlide();
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
  };

  if (isLoading) {
    return (
      <div id={`${viewerId}-loading-screen`} className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div id={`${viewerId}-loading-content`} className="text-white text-center">
          <div id={`${viewerId}-loading-title`} className="text-lg font-semibold mb-2">Loading presentation...</div>
          <p id={`${viewerId}-loading-label`} className="text-sm text-slate-400">Please wait</p>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div id={`${viewerId}-empty-screen`} className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div id={`${viewerId}-empty-content`} className="text-white text-center">
          <div id={`${viewerId}-empty-title`} className="text-lg font-semibold mb-2">No slides available</div>
          <button
            id={`${viewerId}-empty-back-button`}
            onClick={() => navigate(`/case-selection/${presentationId}`)}
            className="mt-4 text-blue-400 hover:text-blue-300"
          >
            Back to case selection
          </button>
        </div>
      </div>
    );
  }

  const currentSlideData = slides[currentSlide];
  const slideId = buildDomId(viewerId, "slide", currentSlide + 1, currentSlideData.type);
  const thumbnailToggleLabel = showThumbnails ? "Hide thumbnails" : "Show thumbnails";
  const goHome = () => navigate("/presentations#presentations-screen-content");

  return (
    <div id={`${viewerId}-root`} className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      {/* Top Bar */}
      <div
        id={`${viewerId}-topbar`}
        className={`bg-slate-800/90 backdrop-blur-lg border-b border-slate-700 px-4 ${
          isCompactLandscape ? "py-2" : "py-3"
        }`}
      >
        <div id={`${viewerId}-topbar-row`} className="flex items-center justify-between gap-3">
          <div id={`${viewerId}-primary-actions`} className="flex items-center gap-2">
            <ActionButton
              id={`${viewerId}-menu-button`}
              onClick={() => navigate("/menu")}
              className="backdrop-blur-sm"
              aria-label="Open menu"
              label="Menu"
              tone="dark"
              icon={<Menu className="w-5 h-5" />}
            />
            <ActionButton
              id={`${viewerId}-home-button`}
              onClick={goHome}
              className="backdrop-blur-sm"
              aria-label="Go to presentations"
              label="Home"
              tone="dark"
              icon={<Home className="w-5 h-5" />}
            />
          </div>

          <ActionButton
            id={`${viewerId}-back-button`}
            onClick={() => navigate(`/case-selection/${presentationId}`)}
            className="backdrop-blur-sm"
            aria-label="Go back"
            label="Back"
            tone="dark"
            icon={<ArrowLeft className="w-5 h-5" />}
          />
        </div>

        <div
          id={`${viewerId}-title-group`}
          className={`${isCompactLandscape ? "mt-1" : "mt-2"} text-center`}
        >
          <div id={`${viewerId}-title`} className="font-semibold text-white">{deckTitle}</div>
          <div id={`${viewerId}-slide-counter`} className="text-sm text-slate-400">Slide {currentSlide + 1} of {totalSlides}</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        id={`${viewerId}-content`}
        className={`flex-1 min-h-0 flex overflow-hidden ${isCompactLandscape ? "flex-row" : "flex-col lg:flex-row"}`}
      >
        {/* Slide Stage */}
        <div 
          id={`${viewerId}-stage`}
          className={`flex-1 min-h-0 relative flex items-center justify-center overflow-hidden ${
            isCompactLandscape ? "px-3 py-3" : "px-4 py-4 lg:p-8"
          }`}
          onPointerMove={revealNavigationButtons}
          onClick={revealNavigationButtons}
          style={dynamicBackdrop && currentSlideData.type === 'image' ? {
            backgroundImage: `url(${currentSlideData.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : {}}
        >
          {/* Backdrop overlay for dynamic backdrop */}
          {dynamicBackdrop && currentSlideData.type === 'image' && (
            <div id={`${viewerId}-dynamic-backdrop`} className="absolute inset-0 bg-slate-900/80 backdrop-blur-2xl" />
          )}

          {/* Slide Container */}
          <div 
            id={`${viewerId}-slide-frame`}
            className={`relative z-10 w-full max-h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-2xl overflow-hidden ${
              orientationMode === 'portrait' ? 'max-w-2xl aspect-[9/16]' :
              orientationMode === 'landscape' ? 'max-w-6xl aspect-[16/9]' :
              'max-w-5xl aspect-[16/9]'
            }`}
            onTouchStartCapture={handleTouchStart}
            onTouchEndCapture={handleTouchEnd}
            onTouchCancelCapture={handleTouchCancel}
            onPointerMove={revealNavigationButtons}
            onClick={revealNavigationButtons}
            style={{ touchAction: 'pan-y pinch-zoom' }}
          >
            {/* Image Slide */}
            <div
              key={`${currentSlideData.id}-${currentSlide}`}
              ref={slideContentRef}
              className="absolute inset-0"
            >
              {currentSlideData.type === 'image' && (
                <ImageSlide
                  idPrefix={slideId}
                  url={currentSlideData.url}
                  title={currentSlideData.title || `Slide ${currentSlide + 1}`}
                  hotspots={currentSlideData.hotspots}
                  onHotspotClick={handleHotspotClick}
                  onZoomToggle={handleZoomToggle}
                />
              )}

              {/* Video Slide */}
              {currentSlideData.type === 'video' && (
                <VideoSlide
                  idPrefix={slideId}
                  url={currentSlideData.url}
                  title={currentSlideData.title || `Slide ${currentSlide + 1}`}
                />
              )}

              {/* HTML Slide */}
              {currentSlideData.type === 'html' && (
                <HtmlSlide
                  idPrefix={slideId}
                  url={currentSlideData.url}
                  title={currentSlideData.title || `Slide ${currentSlide + 1}`}
                />
              )}
            </div>

            {/* Navigation Buttons (overlay on slide) */}
            <button
              id={`${viewerId}-previous-slide-button`}
              onClick={goToPreviousSlide}
              disabled={currentSlide === 0}
              className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-[opacity,background-color] duration-500 disabled:cursor-not-allowed z-20 ${
                showNavButtons ? 'opacity-100' : 'opacity-0 pointer-events-none'
              } ${currentSlide === 0 ? 'disabled:opacity-30' : ''}`}
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            
            <button
              id={`${viewerId}-next-slide-button`}
              onClick={goToNextSlide}
              disabled={currentSlide === totalSlides - 1}
              className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-[opacity,background-color] duration-500 disabled:cursor-not-allowed z-20 ${
                showNavButtons ? 'opacity-100' : 'opacity-0 pointer-events-none'
              } ${currentSlide === totalSlides - 1 ? 'disabled:opacity-30' : ''}`}
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Controls */}
          <div
            id={`${viewerId}-controls`}
            className={`absolute flex flex-wrap justify-end gap-2 z-10 transition-[opacity,transform] duration-500 ${
              showNavButtons ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
            } ${
              isCompactLandscape ? "top-3 right-3 max-w-[calc(100%-1.5rem)]" : "top-6 right-6 max-w-[calc(100%-2rem)]"
            }`}
          >
            {/* Orientation Controls */}
            <div id={`${viewerId}-orientation-controls`} className="flex flex-wrap justify-end gap-2 rounded-lg">
              <ActionButton
                id={`${viewerId}-orientation-auto-button`}
                onClick={() => handleOrientationChange('auto')}
                className="backdrop-blur-sm"
                aria-label="Auto orientation"
                label="Auto"
                tone="dark"
                active={orientationMode === 'auto'}
                icon={<Maximize className="w-4 h-4" />}
              />
              <ActionButton
                id={`${viewerId}-orientation-portrait-button`}
                onClick={() => handleOrientationChange('portrait')}
                className="backdrop-blur-sm"
                aria-label="Portrait orientation"
                label="Portrait"
                tone="dark"
                active={orientationMode === 'portrait'}
                icon={<Smartphone className="w-4 h-4" />}
              />
              <ActionButton
                id={`${viewerId}-orientation-landscape-button`}
                onClick={() => handleOrientationChange('landscape')}
                className="backdrop-blur-sm"
                aria-label="Landscape orientation"
                label="Landscape"
                tone="dark"
                active={orientationMode === 'landscape'}
                icon={<Monitor className="w-4 h-4" />}
              />
            </div>
            
            <ActionButton
              id={`${viewerId}-toggle-thumbnails-button`}
              onClick={toggleThumbnails}
              className="backdrop-blur-sm"
              aria-label={thumbnailToggleLabel}
              label={showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
              tone="dark"
              icon={
                showThumbnails ? (
                  <PanelRightClose className="w-5 h-5" />
                ) : (
                  <PanelRightOpen className="w-5 h-5" />
                )
              }
            />
            <ActionButton
              id={`${viewerId}-toggle-fullscreen-button`}
              onClick={toggleFullscreen}
              className="backdrop-blur-sm"
              aria-label="Toggle fullscreen"
              label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              tone="dark"
              active={isFullscreen}
              icon={<Maximize2 className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Thumbnail Strip (side on desktop, bottom on mobile) */}
        {showThumbnails && (
          <div
            id={`${viewerId}-thumbnail-rail`}
            ref={thumbnailRailRef}
            className={`shrink-0 min-h-0 border-slate-700 bg-slate-800 ${
              isCompactLandscape
                ? "w-32 border-l px-2 py-2 overflow-y-auto overflow-x-hidden"
                : "h-36 sm:h-40 lg:h-auto lg:w-64 border-t lg:border-t-0 lg:border-l px-2 py-3 sm:px-3 sm:py-4 overflow-x-auto overflow-y-hidden lg:overflow-x-hidden lg:overflow-y-auto"
            }`}
          >
            <div
              id={`${viewerId}-thumbnail-track`}
              className={`flex gap-2 ${isCompactLandscape ? "flex-col min-w-0" : "min-w-max lg:min-w-0 lg:flex-col"}`}
            >
              {slides.map((slide, index) => (
                <Thumbnail
                  key={slide.id}
                  idPrefix={buildDomId(viewerId, "thumbnail", index + 1)}
                  slide={slide}
                  index={index}
                  currentSlide={currentSlide}
                  goToSlide={goToSlide}
                  compact={isCompactLandscape}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
