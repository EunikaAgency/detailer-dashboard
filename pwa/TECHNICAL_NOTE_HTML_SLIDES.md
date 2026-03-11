# Technical Figma Note: HTML Slides and HTML Slide Thumbnails

**For:** One Detailer Presentation Viewer  
**Date:** March 11, 2026  
**Context:** HTML slides are a first-class slide type, rendered in sandboxed iframes with dedicated thumbnail handling

---

## 🎯 Quick Summary

HTML slides render as **sandboxed embedded content** inside the presentation viewer, not as static images. They support interactive features, emit analytics events, and use dedicated thumbnail images (or generic placeholders). This note explains how HTML slides are detected, normalized, rendered, sized, and thumbnailed.

---

## 1️⃣ HTML Slide Type Detection

### **When Is a Slide Considered HTML?**

A slide is treated as HTML when **any** of the following is true:

```json
{
  "type": "html"
}
```

```json
{
  "mimeType": "text/html"
}
```

```
File extension: .html, .htm, or .xhtml
```

### **JSON Schema Examples**

**Product Media:**
```json
{
  "id": "slide-html-1",
  "type": "html",
  "url": "src/config/demo/demo-html/html-slide.html",
  "thumbnailUrl": "src/config/demo/demo-html/html-thumb.jpg",
  "title": "Interactive HTML Slide"
}
```

**Subcase Slide:**
```json
{
  "type": "html",
  "src": "src/config/demo/demo-html/html-slide.html",
  "thumbnail": "src/config/demo/demo-html/html-thumb.jpg",
  "caption": "Interactive HTML Slide"
}
```

### **Accepted Source Fields**

HTML slides can specify their source URL via:
- `url`
- `src`
- `path`
- `image`
- `imageUrl`
- `fileUrl`

### **Accepted Thumbnail Fields**

HTML slide thumbnails can be specified via:
- `thumbnailUrl`
- `thumbnail`
- `thumb`
- `previewUrl`

---

## 2️⃣ HTML Slide Normalization

### **How Normalized HTML Slides Differ from Images**

**Key Difference:**  
HTML slides **do NOT use the blob media cache path**. The `uri` field is set directly to the `sourceUrl`.

**Normalized Example:**
```json
{
  "id": "slide-html-1",
  "sourceUrl": "https://otsukadetailer.site/app-capacitor/src/config/demo/demo-html/html-slide.html",
  "uri": "https://otsukadetailer.site/app-capacitor/src/config/demo/demo-html/html-slide.html",
  "mediaType": "html",
  "thumbUri": "https://otsukadetailer.site/app-capacitor/src/config/demo/demo-html/html-thumb.jpg",
  "title": "Interactive HTML Slide",
  "hotspots": []
}
```

### **Important Notes**

- `uri` = `sourceUrl` directly
- `thumbUri` is resolved separately (optional)
- `hotspots` are typically empty for HTML slides

---

## 3️⃣ HTML Slide Rendering Architecture

### **DOM Structure**

HTML slides render in an **iframe**, not an `<img>` tag.

```
┌─ Slide Stage Container ──────────────────┐
│                                           │
│  ┌─ Loading Overlay (optional) ────────┐ │
│  │  Loading spinner / error message    │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  ┌─ .slide-html-wrap ───────────────────┐│
│  │                                       ││
│  │  <iframe                              ││
│  │    id="slide-html"                    ││
│  │    class="slide-media"                ││
│  │    src="...html-slide.html"           ││
│  │    sandbox="allow-scripts             ││
│  │             allow-same-origin         ││
│  │             allow-forms"              ││
│  │    title="Slide 3 of 12">             ││
│  │  </iframe>                            ││
│  │                                       ││
│  └───────────────────────────────────────┘│
│                                           │
└───────────────────────────────────────────┘
```

### **Iframe Attributes**

```html
<iframe
  id="slide-html"
  class="slide-media"
  src="{normalized HTML slide URL}"
  title="Slide {number} of {total}"
  sandbox="allow-scripts allow-same-origin allow-forms"
/>
```

### **Security: Sandboxed Environment**

The iframe uses the `sandbox` attribute with:
- `allow-scripts` - Enables JavaScript execution inside the HTML document
- `allow-same-origin` - Allows same-origin requests (API calls from HTML content)
- `allow-forms` - Enables form interactions

---

## 4️⃣ HTML Slide Sizing and Fitting

### **Auto-Measurement After Load**

The app attempts to measure the iframe's document dimensions after load:

**Measurement Logic:**
```typescript
// Inspect iframe document
const html = iframeDocument.documentElement;
const body = iframeDocument.body;

// Compute dimensions
const contentWidth = Math.max(
  html.scrollWidth,
  html.clientWidth,
  body.scrollWidth,
  body.clientWidth
);

const contentHeight = Math.max(
  html.scrollHeight,
  html.clientHeight,
  body.scrollHeight,
  body.clientHeight
);

// Derive aspect ratio
const aspectRatio = contentWidth / contentHeight;

// Fallback if measurement fails
if (!aspectRatio || !isFinite(aspectRatio)) {
  aspectRatio = 16 / 9;
}
```

### **Stage Fitting Rules**

HTML slides are **fit into the stage** while preserving aspect ratio:

```typescript
// Constraints
maxWidth = stageWidth - 20;
maxHeight = stageHeight - 20;
minWidth = 220;
minHeight = 180;

// Wrapper is centered in the stage
```

### **Visual Implication**

**HTML slides do NOT simply stretch full-width like a normal webpage.**  
They are **boxed and centered** inside the presentation stage, similar to how image slides are contained.

**Example:**
```
┌─ Presentation Stage ────────────────────────┐
│                                             │
│         ┌─ HTML Iframe (fit) ──────┐       │
│         │                           │       │
│         │   Interactive Content     │       │
│         │                           │       │
│         └───────────────────────────┘       │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 5️⃣ HTML Content Centering

### **Best-Effort DOM Adjustments**

After the iframe loads, the app attempts to center the HTML document content by injecting styles into the iframe's document:

**Injected Styles:**
```css
html {
  height: 100%;
}

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
```

### **Important Limitation**

These adjustments **may fail** if:
- Cross-origin restrictions prevent DOM access
- The HTML slide has its own conflicting styles
- The sandbox policy blocks style injection

**Recommendation:**  
HTML slide authors should design content to be self-contained and centered, not relying solely on host-injected centering.

---

## 6️⃣ HTML Slide Load States

### **Three Load States**

HTML slides use the same **loading overlay model** as image/video slides:

#### **1. Loading State**
- Loading overlay visible
- Spinner shown
- iframe loading in background

#### **2. Loaded State**
- Loading overlay hidden
- Centering/layout logic runs
- Activity/debug success logged

#### **3. Error State**
- Loading overlay shows error label
- Example: `Image unavailable` or `Slide unavailable`
- iframe may be blank or show browser error page

---

## 7️⃣ HTML Slide Thumbnails

### **Critical Distinction**

**HTML slides do NOT automatically render a live miniature of the iframe.**

Thumbnail behavior depends on whether a thumbnail image is provided in the JSON.

---

## 8️⃣ HTML Thumbnail Behavior

### **Two Thumbnail States**

#### **State 1: HTML Slide with Thumbnail Image**

**JSON Example:**
```json
{
  "type": "html",
  "url": "src/config/demo/demo-html/html-slide.html",
  "thumbnailUrl": "src/config/demo/demo-html/html-thumb.jpg"
}
```

**Visual Treatment:**
- Render thumbnail like a normal image thumbnail
- Show loading spinner while image loads
- Hide spinner on success
- Show `No preview` if thumbnail image fails to load

**Thumbnail Visual:**
```
┌─ Thumbnail Card ──────────┐
│                            │
│  [Thumbnail Image]         │
│  (loaded from              │
│   thumbnailUrl)            │
│                            │
└────────────────────────────┘
```

---

#### **State 2: HTML Slide with Placeholder**

**JSON Example:**
```json
{
  "type": "html",
  "url": "src/config/demo/demo-html/html-slide.html"
}
```

**Visual Treatment:**
- Render a **neutral placeholder tile**
- Centered text label: **`HTML`**
- No fake screenshot implied
- Typically uses muted background color

**Placeholder Visual:**
```
┌─ Thumbnail Card ──────────┐
│                            │
│                            │
│         HTML               │
│                            │
│                            │
└────────────────────────────┘
```

**Design Implication:**  
Figma should have **BOTH variants**, not just one generic HTML thumbnail card.

---

## 9️⃣ HTML Thumbnail Loading States

### **For Thumbnails with Images**

**Loading:**
```
┌─────────────────┐
│                 │
│   [Spinner]     │
│                 │
└─────────────────┘
```

**Loaded:**
```
┌─────────────────┐
│                 │
│  [Image]        │
│                 │
└─────────────────┘
```

**Error:**
```
┌─────────────────┐
│                 │
│  No preview     │
│                 │
└─────────────────┘
```

### **For Placeholder Thumbnails**

**Always Shows:**
```
┌─────────────────┐
│                 │
│     HTML        │
│                 │
└─────────────────┘
```

*(No loading or error states - placeholder is instant)*

---

## 🔟 HTML Slide Interactivity

### **HTML Slides Can Be Interactive**

HTML slides can contain:
- Buttons
- Forms
- Sliders
- Tabs/Segmented controls
- Custom interactive zones
- Drag-and-drop elements

### **Analytics Integration via postMessage**

The host viewer listens for `window.postMessage` events from the iframe.

**Expected Message Format:**
```json
{
  "type": "detailer-demo-event",
  "action": "html_button_click",
  "details": {
    "label": "Main CTA"
  }
}
```

### **Host Behavior**

When the iframe sends a postMessage:
1. Host receives message
2. Host logs activity event
3. Host enriches event with:
   - `deckId`
   - `slideIndex`
   - `mediaType: "html"`

### **Supported Interaction Types**

HTML slides can report:
- Button clicks
- Zone taps
- Swipes
- Slider changes
- Segment selection
- Long press
- Other custom authored interactions

**Design Implication:**  
An HTML slide is an **embedded interactive mini-experience**, not just a static rich-media card.

---

## 1️⃣1️⃣ HTML Slides vs Hotspots

### **Important Distinction**

**JSON-defined hotspots** (overlay navigation buttons) are only rendered for **image slides**.

**HTML slides do NOT use the external hotspot overlay layer.**

**Navigation Comparison:**

| Slide Type | Navigation Method |
|------------|-------------------|
| Image Slide | JSON hotspot overlay buttons on top of image |
| HTML Slide | Interactive elements **inside** the HTML document |

**Why?**

HTML slides are self-contained interactive documents. Navigation/interaction is authored directly in the HTML, not as external JSON hotspots.

---

## 1️⃣2️⃣ HTML Slide Authoring Recommendations

### **Best Practices for HTML Slide Authors**

1. **Explicitly set `type: "html"`** in the JSON
2. **Provide a stable HTML file path/URL**
3. **Provide a dedicated thumbnail image** (don't rely on placeholder)
4. **Keep layout self-contained** - don't assume full window size
5. **Avoid relying on unrestricted parent DOM access** - iframe is sandboxed
6. **Emit `postMessage` events** if analytics interactions matter

### **Recommended postMessage Format**

```javascript
window.parent.postMessage(
  {
    type: "detailer-demo-event",
    action: "my_custom_action",
    details: {
      buttonId: "cta-1",
      label: "Learn More"
    }
  },
  "*"
);
```

---

## 1️⃣3️⃣ Debug Mode and HTML Slides

### **Slide Freshness Diagnostics**

When **Debug Mode** is enabled, the viewer can show a **slide freshness stamp** overlay on HTML slides:

**Example Overlay:**
```
Fetched: 2026-03-11 08:15:12
Age: 3 minutes ago
```

**What It Shows:**
- When the HTML slide was fetched
- How old the cached slide is

**Design Implication:**  
Figma should include a debug viewer variant with a small diagnostic stamp overlay in the slide stage.

---

## 1️⃣4️⃣ What Figma Should Show

### **Required Figma Variants**

#### **HTML Viewer States**

1. **HTML Viewer Loading**
   - Same stage shell as image slides
   - Loading overlay visible with spinner

2. **HTML Viewer Loaded**
   - Framed embedded content inside stage
   - Looks centered and fit, **not** full raw browser page
   - Content respects aspect ratio

3. **HTML Viewer Error**
   - Fallback error label in stage
   - Example: `Slide unavailable`

4. **HTML Viewer with Debug Overlay** (Debug Mode)
   - Loaded HTML slide
   - Small diagnostic stamp showing freshness
   - Example: `Fetched: 2026-03-11 08:15:12 • Age: 3 minutes ago`

#### **HTML Thumbnail States**

1. **HTML Thumbnail with Image Preview**
   - Standard thumbnail image treatment
   - Loading spinner → Loaded image → Error fallback

2. **HTML Thumbnail Placeholder**
   - Neutral tile with centered `HTML` label
   - Muted background
   - No loading/error states needed

---

## 1️⃣5️⃣ Recommended Figma Annotations

### **For HTML Viewer Screen**

```
"HTML slides render in a sandboxed iframe and are fit into the 
stage after load. They support interactive elements that can 
emit analytics events back to the host viewer."
```

### **For HTML Thumbnails**

```
"HTML slides may optionally provide a preview image for the 
thumbnail strip. If no preview image exists, the UI shows a 
generic HTML placeholder tile with the label 'HTML'."
```

### **For Debug Mode Viewer**

```
"When Debug Mode is enabled, the viewer shows a slide freshness 
stamp overlay indicating when the HTML slide was fetched and 
how old the cached content is."
```

---

## 1️⃣6️⃣ HTML Slides in the Full App Flow

### **Presentation Flow**

```
Gallery Screen
  ↓
Select Product (may include HTML slides)
  ↓
Case Selection (if product has cases)
  ↓
Viewer Opens
  ↓
Thumbnail Strip Shows:
  - Image thumbnails
  - Video thumbnails
  - HTML thumbnails (with preview OR placeholder)
  ↓
User Taps HTML Thumbnail
  ↓
Viewer Loads HTML Slide in iframe
  ↓
HTML Slide Renders (interactive content)
  ↓
User Interacts (button click, form submit, etc.)
  ↓
HTML Slide Sends postMessage to Host
  ↓
Host Logs Activity Event
```

---

## 1️⃣7️⃣ Technical Implementation Notes

### **File Location**

**Viewer Component:** `/src/app/screens/viewer.tsx`

**HTML Slide Rendering Logic:**
- Detects `mediaType === "html"`
- Renders iframe instead of img/video
- Applies sandbox attributes
- Listens for postMessage events

**Thumbnail Rendering Logic:**
- Checks if `thumbUri` exists
- If yes: render image thumbnail
- If no: render placeholder with "HTML" label

### **Storage & Caching**

- HTML slides **do NOT use blob cache** like images
- `uri` is the direct URL to the HTML file
- Thumbnails (if provided) are cached like normal images

### **Cross-Origin Considerations**

- HTML slides can be same-origin or cross-origin
- Cross-origin HTML may have limited DOM access
- Centering styles may not apply to cross-origin content
- postMessage works regardless of origin

---

## 1️⃣8️⃣ Comparison: HTML vs Image vs Video Slides

| Feature | Image Slide | Video Slide | HTML Slide |
|---------|-------------|-------------|------------|
| **Render Element** | `<img>` | `<video>` | `<iframe>` |
| **Sandbox** | No | No | Yes |
| **Interactive** | No | Basic (play/pause) | Yes (full JS) |
| **Hotspots** | Yes (JSON overlay) | No | No (internal) |
| **Thumbnail** | Auto (same image) | Poster frame | Image or placeholder |
| **postMessage** | No | No | Yes |
| **Blob Cache** | Yes | Yes | No |
| **Aspect Ratio** | Detected from image | Detected from video | Measured or fallback |
| **Error State** | "Image unavailable" | "Video unavailable" | "Slide unavailable" |

---

## 1️⃣9️⃣ Common HTML Slide Use Cases

### **Examples from Real Implementations**

1. **Interactive Product Selector**
   - User taps product variants in the HTML slide
   - Each tap sends a postMessage event
   - Host logs which product was selected

2. **Embedded Quiz or Poll**
   - HTML slide contains multiple-choice questions
   - User selects answer
   - postMessage reports answer choice

3. **Data Visualization Dashboard**
   - HTML slide shows interactive charts
   - User hovers/clicks on data points
   - postMessage logs interaction

4. **Form or Calculator**
   - User inputs values into form
   - HTML slide calculates result
   - postMessage reports form submission

5. **3D Model Viewer**
   - HTML slide embeds WebGL 3D viewer
   - User rotates/zooms model
   - postMessage logs interaction events

---

## 2️⃣0️⃣ Error Handling Summary

### **HTML Slide Errors**

**Possible Errors:**
- HTML file not found (404)
- HTML file failed to load (network error)
- iframe blocked by CSP/CORS
- iframe sandbox violation

**Error State:**
- Loading overlay shows error message
- Example: `Slide unavailable`
- iframe may show browser error page

### **HTML Thumbnail Errors**

**If Thumbnail Image Provided:**
- Thumbnail fails to load
- Show: `No preview`

**If No Thumbnail Provided:**
- Always show placeholder
- No error state possible

---

## ✅ Quick Checklist for Designers

### **HTML Viewer Variants**
- [ ] HTML slide loading (spinner)
- [ ] HTML slide loaded (framed content)
- [ ] HTML slide error (error message)
- [ ] HTML slide with debug overlay (freshness stamp)

### **HTML Thumbnail Variants**
- [ ] HTML thumbnail with preview image (loading)
- [ ] HTML thumbnail with preview image (loaded)
- [ ] HTML thumbnail with preview image (error)
- [ ] HTML thumbnail placeholder (`HTML` label)

### **Viewer Features**
- [ ] Thumbnail strip includes HTML slides
- [ ] HTML slides render in iframe, not img
- [ ] HTML slides are centered and fit to stage
- [ ] HTML slides support interaction (visual affordance)

### **Debug Mode**
- [ ] Debug mode enables freshness stamp
- [ ] Freshness stamp shows fetch time and age
- [ ] Demo product may include HTML slide examples

---

## 📚 Related Documentation

- **`/src/imports/pasted_text/html-slide-spec.md`** - Full HTML slide specification
- **`/src/imports/pasted_text/debug-mode-spec.md`** - Debug mode behavior
- **`/src/imports/pasted_text/diagnostics-logs-spec.md`** - Diagnostics logging
- **`/IMPLEMENTATION_PRINCIPLES.md`** - Overall app architecture
- **`/SESSIONS_SPECIFICATION.md`** - Activity session grouping

---

**End of Technical Note**  
*HTML Slides and HTML Slide Thumbnails*  
*March 11, 2026*
