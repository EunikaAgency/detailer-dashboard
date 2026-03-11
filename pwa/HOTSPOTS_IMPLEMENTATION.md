# One Detailer - Hotspots Implementation

**Status:** ✅ Implemented  
**Feature:** Interactive slide navigation regions

---

## 🎯 Overview

**Hotspots** are interactive regions placed on image slides that allow presenters to tap a defined area of the current slide and jump to another slide in the same deck.

### Key Characteristics

- **Data-driven** from slide JSON
- **Image slides only** - rendered only for image type slides
- **Deck-scoped navigation** - link to another slide in the same deck
- **Always clickable** - even when visual outlines are hidden
- **Normalized coordinates** - position defined as 0-1 fractions, not pixels

---

## 📋 Hotspot Data Structure

### JSON Schema

Hotspots are attached to individual slides within a deck:

```json
{
  "_id": "prod-001",
  "name": "Abilify Maintena",
  "media": [
    {
      "groupId": "abilify-maintena-hcp-overview",
      "title": "HCP Overview",
      "items": [
        {
          "id": "slide-2",
          "type": "image",
          "url": "src/assets/abilify-slide-2.jpg",
          "title": "Clinical Data",
          "hotspots": [
            {
              "id": "hs-1",
              "x": 0.12,
              "y": 0.18,
              "w": 0.20,
              "h": 0.16,
              "shape": "rect",
              "targetPageId": "src/assets/abilify-slide-5.jpg"
            }
          ]
        }
      ]
    }
  ]
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Optional | Unique hotspot identifier |
| `x` | number | **Required** | Left position as normalized fraction (0-1) of image width |
| `y` | number | **Required** | Top position as normalized fraction (0-1) of image height |
| `w` | number | **Required** | Width as normalized fraction (0-1) of image width |
| `h` | number | **Required** | Height as normalized fraction (0-1) of image height |
| `shape` | string | Optional | Shape type (currently only 'rect' supported) |
| `targetPageId` | string | **Required** | Target slide URL/path for navigation |

### Important Notes

- **Normalized values:** Coordinates are NOT pixels. They are proportional values (0-1) relative to the displayed image.
- **Example:** `x: 0.12` means "12% from the left edge of the image"
- **Example:** `w: 0.20` means "20% of the image width"

---

## 🔄 Target Resolution

Hotspots do not use hardcoded numeric slide indices in JSON. Instead, they use URL-based targeting.

### Resolution Process

```
1. Each slide has a normalized sourceUrl
2. Each hotspot has a targetPageId
3. At runtime:
   - Build sourceUrl → slideIndex map for all slides in deck
   - For each hotspot:
     - Normalize targetPageId
     - Look up matching slide index
     - If target missing → discard hotspot
     - If target found → create normalized hotspot with targetIndex
```

### Normalized Hotspot Object (Runtime)

After resolution, hotspots are normalized to:

```typescript
{
  id?: string;
  x: number;        // 0-1
  y: number;        // 0-1
  w: number;        // 0-1
  h: number;        // 0-1
  shape?: string;
  targetIndex: number;  // Resolved from targetPageId
}
```

### URL Normalization

```typescript
function normalizeSlideUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')    // Remove protocol
    .replace(/^[^/]+/, '')           // Remove domain
    .split('?')[0]                   // Remove query params
    .split('#')[0]                   // Remove hash
    .trim();
}
```

**Example:**
- Input: `https://example.com/assets/slide-5.jpg?version=2#page1`
- Output: `/assets/slide-5.jpg`

---

## 🎨 Rendering Implementation

### Coordinate Calculation

Hotspots are positioned **relative to the rendered image bounds**, not the container.

**Why this matters:** Slides use `object-fit: contain`, so empty margins may exist around the image.

### Positioning Formula

```typescript
// Calculate actual image dimensions considering object-fit: contain
const imageAspect = naturalWidth / naturalHeight;
const containerAspect = containerWidth / containerHeight;

let renderedWidth, renderedHeight, offsetX, offsetY;

if (imageAspect > containerAspect) {
  // Image is wider - fit to width
  renderedWidth = containerWidth;
  renderedHeight = containerWidth / imageAspect;
  offsetX = 0;
  offsetY = (containerHeight - renderedHeight) / 2;
} else {
  // Image is taller - fit to height
  renderedHeight = containerHeight;
  renderedWidth = containerHeight * imageAspect;
  offsetX = (containerWidth - renderedWidth) / 2;
  offsetY = 0;
}

// Calculate hotspot pixel positions
const left = offsetX + (hotspot.x * renderedWidth);
const top = offsetY + (hotspot.y * renderedHeight);
const width = hotspot.w * renderedWidth;
const height = hotspot.h * renderedHeight;
```

### Implementation Component

File: `/src/app/components/viewer/hotspot-overlay.tsx`

**Features:**
- Calculates image bounds with `object-fit: contain` support
- Uses ResizeObserver to update on container resize
- Renders absolutely positioned button overlays
- Respects `showHotspotAreas` setting for visual markers
- Always maintains clickability regardless of visual state

---

## 🎛️ Settings Integration

### Show Hotspot Areas Setting

Location: **Advanced Settings** → "Show hotspot areas"

**What it controls:**
- Toggles whether hotspot rectangles are visibly outlined/highlighted
- Primarily for debug/training/demo visibility

**Important UX Detail:**
- **When enabled:** Translucent blue rectangular overlays visible
- **When disabled:** No visible markers, but hotspots remain clickable
- **"Hide hotspots" means "hide visual markers," not "disable hotspot navigation"**

### Visual States

#### Normal Presentation Mode (Setting OFF)
```css
.hotspot {
  background: transparent;
  /* Invisible but still clickable */
}
```

#### Debug/Training Mode (Setting ON)
```css
.hotspot {
  background: rgba(59, 130, 246, 0.2);  /* blue-500/20 */
  border: 2px solid rgb(59, 130, 246);   /* blue-500 */
}
```

---

## 📊 Event Tracking

### Hotspot Tap Event

When a hotspot is clicked:

```typescript
trackEvent('activity', 'hotspot_tapped', 'presentation', {
  deckId: 'abilify-maintena-hcp-overview',
  fromIndex: 1,
  toIndex: 4,
  hotspotId: 'hs-1'
});
```

**Event Structure:**
```json
{
  "eventType": "activity",
  "action": "hotspot_tapped",
  "screen": "presentation",
  "method": "password",
  "source": "online",
  "timestamp": "2026-03-11T10:30:00.000Z",
  "details": {
    "deckId": "abilify-maintena-hcp-overview",
    "fromIndex": 1,
    "toIndex": 4,
    "hotspotId": "hs-1"
  }
}
```

---

## 🔍 When Hotspots Appear

### Slide Type Rules

| Slide Type | Hotspot Support | Reason |
|------------|----------------|---------|
| **Image** | ✅ Yes | Primary use case |
| **Video** | ❌ No | Interactive controls conflict |
| **HTML** | ❌ No | May have own interactivity |

### Validation Rules

- If slide has no `hotspots` array → No overlay rendered
- If all hotspots have invalid targets → No overlay rendered
- If some hotspots have invalid targets → Only valid ones rendered

---

## 📝 JSON Authoring Guidelines

### Good Example ✅

```json
{
  "hotspots": [
    {
      "id": "hs-efficacy",
      "x": 0.68,
      "y": 0.22,
      "w": 0.18,
      "h": 0.12,
      "shape": "rect",
      "targetPageId": "src/assets/slide-8.jpg"
    }
  ]
}
```

**Why good:**
- Normalized coordinates (0-1 range)
- Within image bounds
- Valid target slide reference
- Descriptive ID

### Bad Example ❌

```json
{
  "hotspots": [
    {
      "x": 240,
      "y": 100,
      "w": 120,
      "h": 80,
      "targetPageId": "non-existent-slide.jpg"
    }
  ]
}
```

**Why bad:**
- Uses pixel values instead of normalized (0-1)
- Target slide may not exist
- Will be discarded during normalization

### Best Practices

1. **Keep coordinates 0-1:** Always use normalized values
2. **Stay in bounds:** `x + w ≤ 1.0` and `y + h ≤ 1.0`
3. **Verify targets:** Ensure targetPageId matches actual slide URL
4. **Use descriptive IDs:** Makes debugging easier
5. **Prefer rect shape:** Only rect is currently supported
6. **Only on images:** Don't add hotspots to video/HTML slides

---

## 🧪 Implementation Details

### File Structure

```
/src/app/components/viewer/
  hotspot-overlay.tsx         # Hotspot rendering component

/src/app/lib/
  products.ts                 # Hotspot normalization logic

/src/app/screens/
  viewer.tsx                  # Presentation viewer with hotspot support

/src/app/lib/
  settings.ts                 # Settings management
```

### Key Functions

**`normalizeSlides(items)` - `/src/app/lib/products.ts`**
```typescript
// Normalizes slides with hotspot targetIndex resolution
export function normalizeSlides(items: any[]): NormalizedSlide[]
```

**`normalizeHotspots(hotspots, slides)` - `/src/app/lib/products.ts`**
```typescript
// Resolves targetPageId to targetIndex
function normalizeHotspots(
  hotspots: any[] | undefined,
  slides: any[]
): NormalizedHotspot[]
```

**`HotspotOverlay` - `/src/app/components/viewer/hotspot-overlay.tsx`**
```typescript
interface HotspotOverlayProps {
  hotspots: Hotspot[];
  imageElement: HTMLImageElement | null;
  onHotspotClick: (targetIndex: number, hotspot: Hotspot) => void;
}
```

---

## 🎬 User Flow

### Scenario: Presenter Using Hotspots

```
1. Presenter opens CardioHealth presentation
2. Navigates to "Standard Treatment Protocol" case
3. Reaches "Treatment Overview" slide (has 1 hotspot)
4. Setting: "Show hotspot areas" is ON
   → Blue rectangle visible on right side of slide
5. Presenter taps hotspot rectangle
6. App tracks hotspot_tapped event
7. Viewer jumps to "Clinical Data" slide
8. Presenter continues presentation
```

### Scenario: Hidden Hotspots

```
1. Setting: "Show hotspot areas" is OFF
2. Hotspot rectangles are invisible
3. Presenter knows where to tap from training/experience
4. Taps invisible hotspot area
5. Navigation still works perfectly
6. Event still tracked
```

---

## 🔧 Testing Scenarios

### Test 1: Basic Hotspot Navigation
```
Given: Slide with 1 hotspot pointing to slide 4
When: User clicks hotspot
Then: Viewer navigates to slide 4
And: Event tracked with fromIndex=1, toIndex=4
```

### Test 2: Multiple Hotspots
```
Given: Slide with 2 hotspots (targets slide 1 and slide 3)
When: User clicks first hotspot
Then: Navigates to slide 1
When: User returns and clicks second hotspot
Then: Navigates to slide 3
```

### Test 3: Invalid Target
```
Given: Slide with hotspot targeting non-existent slide
When: Slides are normalized
Then: Hotspot is discarded
And: No interactive region appears
```

### Test 4: Show Areas Toggle
```
Given: Viewer with hotspots
When: Setting "Show hotspot areas" is ON
Then: Blue rectangles visible
When: Setting toggled OFF
Then: Rectangles disappear
But: Hotspots still clickable
```

### Test 5: Responsive Positioning
```
Given: Viewer with hotspots
When: Window is resized
Then: Hotspot positions update correctly
And: Remain aligned to image bounds
```

### Test 6: Object-Fit Contain
```
Given: Wide image in tall container
When: Image is displayed with object-fit: contain
Then: Image has vertical margins
And: Hotspots are positioned relative to image, not container
And: Hotspots do NOT appear in margins
```

---

## 📊 Implementation Statistics

| Metric | Value |
|--------|-------|
| **New Components** | 1 (HotspotOverlay) |
| **Updated Screens** | 1 (Viewer) |
| **New Functions** | 3 (normalizeSlides, normalizeHotspots, normalizeSlideUrl) |
| **Settings Used** | 1 (showHotspotAreas) |
| **Event Types** | 1 (hotspot_tapped) |
| **Supported Shapes** | 1 (rect) |
| **Coordinate System** | Normalized (0-1) |

---

## 🎯 Production Readiness

### Implemented Features ✅

- ✅ JSON-driven hotspot data
- ✅ Normalized coordinate system (0-1)
- ✅ targetPageId → targetIndex resolution
- ✅ Object-fit: contain positioning support
- ✅ ResizeObserver for responsive updates
- ✅ Show/hide visual markers setting
- ✅ Always-clickable behavior
- ✅ Event tracking (hotspot_tapped)
- ✅ Image slide only rendering
- ✅ Multiple hotspots per slide
- ✅ Invalid target filtering

### Design States ✅

- ✅ Normal presentation mode (hotspots invisible)
- ✅ Debug mode (hotspots visible with blue overlay)
- ✅ Hover states
- ✅ Loading states
- ✅ Error states (invalid targets discarded)

### Performance ✅

- ✅ Efficient ResizeObserver usage
- ✅ Minimal re-renders
- ✅ No layout thrashing
- ✅ Proper cleanup on unmount

---

## 📖 Summary

Hotspots in One Detailer are:

1. **Data-Driven** - Defined in slide JSON
2. **Normalized** - Use 0-1 coordinates, not pixels
3. **Smart** - Resolve targetPageId to slide index at runtime
4. **Precise** - Account for object-fit: contain positioning
5. **Flexible** - Visual markers can be hidden while maintaining functionality
6. **Tracked** - All interactions logged for analytics
7. **Responsive** - Update on resize automatically
8. **Type-Specific** - Only rendered on image slides

**Production Status:** ✅ **COMPLETE AND READY**

Hotspots provide a professional, interactive presentation experience for medical representatives to navigate complex slide decks dynamically based on audience questions and discussion flow.

---

**End of Hotspots Implementation Documentation**  
*March 11, 2026*
