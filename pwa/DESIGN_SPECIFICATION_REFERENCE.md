# One Detailer - Design Specification Reference

**For:** Figma Design & Development Teams  
**Date:** March 11, 2026  
**Purpose:** Complete behavior catalog with required design states

---

## 📖 How to Use This Document

This document catalogs **every significant behavior and state** that requires design attention in One Detailer. Each entry specifies:

- **Behavior:** What the feature does
- **Where It Appears:** Which screen(s) show this behavior
- **States To Design:** All visual variants needed in Figma
- **Technical Note:** Implementation details and design implications

---

## 🎨 Presentation Viewer Behaviors

| # | Behavior | Where It Appears | States To Design | Technical Note |
|---|----------|------------------|------------------|----------------|
| 1 | **Thumbnail strip toggle** | Presentation Viewer | • Thumbnails visible<br>• Thumbnails hidden | Thumbnail visibility is stored in viewer state and changes layout, not just button appearance. Stage should expand when thumbnails are hidden. |
| 2 | **Fullscreen mode** | Presentation Viewer | • Normal<br>• Fullscreen<br>• Fullscreen + thumbnails hidden | Fullscreen is a true viewer state with different stage/control spacing and immersive framing. Not just browser fullscreen API. |
| 3 | **Orientation mode** | Presentation Viewer | • Auto<br>• Portrait<br>• Landscape | Orientation mode is persisted in viewer state and changes layout materially. Portrait tightens frame, landscape widens it. |
| 4 | **Zoom** | Presentation Viewer (image slides only) | • Normal image<br>• Zoomed image (2x scale) | Zoom applies to image slides only and is tracked as user activity. Double-click to toggle. |
| 5 | **Slide loading** | Presentation Viewer | • Image loading<br>• Video loading<br>• HTML loading | Loading overlay stays until image/video/iframe reports successful load. Shows centered spinner + "Loading slide..." |
| 6 | **Slide error** | Presentation Viewer | • Image unavailable<br>• Video unavailable<br>• HTML unavailable | Failed media shows explicit fallback messaging instead of blank stage. Overlay becomes error message. |
| 7 | **HTML slide loaded** | Presentation Viewer | • Iframe content fit into stage | HTML slides render in sandboxed iframe, not as images. Content is centered and fit with measured/fallback aspect ratio. |
| 8 | **HTML slide loading** | Presentation Viewer | • Loading over framed HTML area | HTML stage reserves space while iframe is still loading. Same loading overlay as other types. |
| 9 | **HTML slide error** | Presentation Viewer | • HTML unavailable state | Fallback state should not resemble a raw broken browser iframe. Shows "Slide unavailable" message. |
| 10 | **Dynamic slide backdrop** | Presentation Viewer | • Backdrop on<br>• Backdrop off | Image slides can drive a soft sampled backdrop fill around the stage. Setting-controlled. |
| 11 | **Hotspots hidden but interactive** | Presentation Viewer (image slides) | • Normal presentation state | Hotspots remain clickable even when visual hotspot outlines are hidden. Interactive zones exist invisibly. |
| 12 | **Hotspots visible** | Presentation Viewer (image slides) | • Debug/training hotspot overlay | Visible hotspot rectangles come from JSON hotspot definitions on image slides. Translucent blue overlays. |
| 13 | **Show hotspot areas** | Presentation Viewer / Advanced Settings | • On (outlines visible)<br>• Off (outlines hidden) | Controls visual hotspot outlines only; does not remove hotspot interactivity. Separate from debug mode. |

---

## 🖼️ Thumbnail Strip Behaviors

| # | Behavior | Where It Appears | States To Design | Technical Note |
|---|----------|------------------|------------------|----------------|
| 14 | **Thumbnail loading/error** | Thumbnail strip | • Thumbnail loading (spinner)<br>• Loaded<br>• Error ("No preview") | Thumbnails have independent load/error lifecycle with spinner and fallback label. |
| 15 | **Active thumbnail** | Thumbnail strip | • Active (highlighted)<br>• Inactive | Active thumb follows current slide index and must be visually obvious. Ring/border highlight. |
| 16 | **HTML thumbnail preview** | Thumbnail strip | • Thumb image present | If HTML slide has authored thumbnail image, render it like a normal thumbnail. Shows spinner → image → error. |
| 17 | **HTML thumbnail placeholder** | Thumbnail strip | • HTML placeholder tile | If no preview image is authored, show generic HTML placeholder. Centered "HTML" label, no fake screenshot. |

---

## 📱 Gallery Behaviors

| # | Behavior | Where It Appears | States To Design | Technical Note |
|---|----------|------------------|------------------|----------------|
| 18 | **Search active state** | Gallery | • Empty search<br>• Typed search<br>• Filtered results | Search filters products by name and should show real filtered results states. Product count changes. |
| 19 | **Category chip selection** | Gallery | • Selected<br>• Unselected | Category chips are generated from product categories and filter gallery cards. Multiple may be selected. |
| 20 | **Product labels shown/hidden** | Gallery | • Labels visible (title + category)<br>• Labels hidden (image-led) | Product labels are controlled by settings and change card density/legibility. |
| 21 | **Gallery columns** | Gallery | • 1 column<br>• 2 columns<br>• 3 columns<br>• 4 columns | Gallery density is a settings-driven layout mode, especially relevant across phone/tablet. |
| 22 | **Syncing state** | Gallery header / app shell | • Idle<br>• Syncing/disabled | Sync button can enter disabled/busy state during manual sync flows. Shows spinner or "Syncing..." |
| 23 | **Remote loading placeholders** | Gallery | • Placeholder grid | Placeholder cards preserve gallery structure while live content loads. Shimmer/skeleton cards. |
| 24 | **Fallback/local content** | Gallery | • Live content<br>• Cached fallback<br>• Bundled fallback | Gallery may still open with usable local content even when live fetch fails. Optional offline banner. |

---

## 📋 Sessions Behaviors

| # | Behavior | Where It Appears | States To Design | Technical Note |
|---|----------|------------------|------------------|----------------|
| 25 | **Pending vs Synced sessions** | Sessions list/detail | • Pending (⏳ badge)<br>• Synced (✓ badge) | Session badge is derived from whether all underlying events have synced. Not based on auth state. |
| 26 | **Session metadata expanded** | Session Detail | • Collapsed metadata<br>• Expanded metadata | Event cards may expose technical metadata in an expandable block. Shows JSON/technical details. |
| 27 | **Sessions empty state** | Sessions list | • Empty<br>• Populated | Sessions are local activity timelines and need a deliberate no-data state. "No activity sessions yet" |
| 28 | **Generated session titles** | Sessions list/detail | • Deterministic title examples | Session titles are locally generated from start time and activity volume, then persisted. E.g., "Tuesday Morning Rise Drift" |

---

## ⚙️ Settings & Global UI Behaviors

| # | Behavior | Where It Appears | States To Design | Technical Note |
|---|----------|------------------|------------------|----------------|
| 29 | **Button style** | App shell-wide | • Icon-only<br>• Labeled | Global settings mode changes multiple controls across screens. Affects headers, back buttons, viewer controls. |
| 30 | **UI scale** | App shell-wide | • Compact<br>• Standard<br>• Comfortable | UI scale is an app density setting, not browser zoom. Affects text size, spacing, card density. |
| 31 | **Debug mode** | Advanced Settings, Gallery, Viewer | • Off (normal mode)<br>• On (diagnostics mode) | Enables runtime diagnostics, freshness overlays, and demo/debug content. Shows slide fetch timestamps in viewer. |

---

## 🚀 App Lifecycle Behaviors

| # | Behavior | Where It Appears | States To Design | Technical Note |
|---|----------|------------------|------------------|----------------|
| 32 | **Boot loading** | App startup | • Initializing state | Shown during hydration of auth, settings, products, media, and activity state. Spinner + "Loading One Detailer..." |
| 33 | **Boot error** | App startup recovery | • Recovery state | Startup failures render recovery UI instead of leaving a white page. "Failed to load app" with retry button. |
| 34 | **Reset cached data** | Recovery / Advanced Settings | • Default<br>• Confirm/result state | Destructive action clears browser app state and forces clean reload. Requires confirmation dialog. |
| 35 | **Install App / How To Install** | Menu | • "Install App" (can install)<br>• "How To Install" (manual)<br>• Hidden (standalone) | Install row changes based on PWA installability and standalone mode. Menu adapts dynamically. |

---

## 📊 Design State Summary

### By Screen

**Presentation Viewer:** 13 behaviors, ~30 states  
**Thumbnail Strip:** 4 behaviors, ~8 states  
**Gallery:** 7 behaviors, ~15 states  
**Sessions:** 4 behaviors, ~8 states  
**Settings/Global:** 3 behaviors, ~6 states  
**App Lifecycle:** 4 behaviors, ~8 states  

**Total:** 35 behaviors, ~75+ design states

---

## 🎯 Critical Design States Checklist

### ✅ Must-Have States (Core UX)

#### Viewer
- [ ] Slide loading (image/video/html)
- [ ] Slide error (image/video/html unavailable)
- [ ] Thumbnails visible vs hidden (with layout reflow)
- [ ] Active vs inactive thumbnails
- [ ] HTML iframe rendering
- [ ] HTML thumbnail placeholder
- [ ] Normal vs fullscreen layout

#### Gallery
- [ ] Search with filtered results
- [ ] Product labels on vs off
- [ ] 2/3/4 column layouts
- [ ] Loading placeholders

#### Sessions
- [ ] Pending vs synced badges
- [ ] Empty state
- [ ] Generated session titles (not generic IDs)

#### Global
- [ ] Boot loading screen
- [ ] Icon-only vs labeled buttons
- [ ] Compact/standard/comfortable scale

---

## 🔍 Design Patterns & Conventions

### Loading States
**Pattern:** Centered spinner + descriptive text  
**Text:** "Loading slide...", "Loading gallery...", "Syncing..."  
**Spinner:** 32px diameter, 3px border, blue-500 color, transparent top for spin effect

### Error States
**Pattern:** Fallback message in place of content  
**Text:** "{Type} unavailable", "Failed to load {content}"  
**Styling:** Muted slate-500 text on slate-50 background, centered

### Empty States
**Pattern:** Icon + primary message + secondary guidance  
**Styling:** Centered vertically, generous padding, helpful not alarming

### Active/Selected States
**Pattern:** Ring/border highlight + color shift  
**Thumbnails:** 2px blue-500 ring with 2px offset  
**Chips:** Filled background vs outlined border  
**Buttons:** Filled vs outlined, or icon-only vs labeled

### Placeholders
**Pattern:** Skeleton/shimmer with preserved layout  
**Styling:** Slate-200 background, subtle pulse animation, match final content dimensions

---

## 📐 Responsive Breakpoints

All behaviors should consider responsive design:

**Mobile (< 640px):**
- Gallery: 1-2 columns max
- Viewer: Portrait-optimized by default
- Thumbnails: Horizontal scroll strip
- UI scale: Compact recommended

**Tablet (640px - 1024px):**
- Gallery: 2-3 columns
- Viewer: Landscape-friendly
- Thumbnails: Grid or horizontal
- UI scale: Standard recommended

**Desktop (> 1024px):**
- Gallery: 3-4 columns
- Viewer: Fullscreen capabilities
- Thumbnails: Grid layout
- UI scale: Comfortable option available

---

## 🎨 Color & Style Tokens

### Interactive States
- **Active/Selected:** blue-500
- **Inactive/Default:** slate-200 border, slate-50 bg
- **Hover:** slate-100 bg
- **Disabled:** slate-300 text, slate-100 bg
- **Error:** red-500 text/border
- **Success:** green-600 text/icon
- **Pending:** amber-600 text/icon

### Loading Overlays
- **Background:** white/90 (90% opacity)
- **Spinner:** blue-500
- **Text:** slate-600

### Error Overlays
- **Background:** slate-50
- **Text:** slate-500

### Placeholders
- **Background:** slate-200
- **Animation:** pulse (2s ease-in-out)

---

## 🧪 Testing Scenarios

### Viewer Testing
1. Load image slide → loading → loaded → zoom toggle
2. Load HTML slide → loading → iframe appears → interaction
3. Load video slide → loading → playback → controls
4. Toggle thumbnails → layout reflows → stage expands
5. Toggle fullscreen → layout changes → immersive mode
6. Fail to load slide → error state appears
7. Click hotspot (hidden) → navigation works
8. Enable hotspot visibility → rectangles appear

### Gallery Testing
1. Empty search → type query → filtered results appear
2. Toggle labels → cards reformat
3. Change columns → grid reflows
4. Enable debug mode → demo product appears
5. Offline mode → cached products shown with banner

### Sessions Testing
1. New session → pending badge
2. Sync session → synced badge
3. No sessions → empty state
4. Expand event → metadata visible
5. Generated title → human-readable format

### Settings Testing
1. Toggle button style → all screens update
2. Change UI scale → density changes app-wide
3. Toggle debug mode → diagnostics enabled
4. Reset cache → confirmation → reload

---

## 📱 PWA-Specific States

### Installation States
1. **Not installable:** Menu shows "How To Install"
2. **Installable:** Menu shows "Install App" with prompt
3. **Installed:** Menu hides install entry
4. **Standalone:** Running as PWA, no browser chrome

### Offline States
1. **Online:** Normal operation, live sync available
2. **Offline:** Cached content, pending events queue
3. **Sync pending:** Events waiting for connection
4. **Sync active:** Spinner on sync button

---

## 🔗 Related Documentation

- **`/IMPLEMENTATION_CHECKLIST.md`** - Implementation status for all 35 behaviors
- **`/TECHNICAL_NOTE_HTML_SLIDES.md`** - Complete HTML slide specification
- **`/TECHNICAL_NOTE_MY_ACCOUNT_MAPPING.md`** - Account field mapping
- **`/IMPLEMENTATION_PRINCIPLES.md`** - Overall app architecture
- **`/SESSIONS_SPECIFICATION.md`** - Session grouping and naming

---

## ✏️ Figma File Organization Recommendation

### Suggested Page Structure

```
📄 One Detailer Design System
  ├── 🎨 Foundations (colors, typography, spacing)
  ├── 🧩 Components (buttons, cards, pills, chips)
  └── 📐 Tokens (theme.css variables)

📄 Presentation Viewer
  ├── 🖼️ Slide States
  │   ├── Image (normal, loading, error, zoomed)
  │   ├── Video (normal, loading, error, playing)
  │   └── HTML (normal, loading, error, iframe)
  ├── 🎞️ Thumbnail Strip
  │   ├── Visible vs Hidden Layout
  │   ├── Active vs Inactive Thumbs
  │   └── HTML Thumb Variants
  ├── 🎛️ Controls
  │   ├── Normal Mode
  │   ├── Fullscreen Mode
  │   └── Orientation Controls
  └── 🔍 Debug/Advanced
      ├── Hotspots Visible
      └── Freshness Overlay

📄 Gallery
  ├── 🔍 Search States
  ├── 🏷️ Category Chips
  ├── 📊 Column Layouts (1/2/3/4)
  ├── 🏷️ Labels On/Off
  └── ⏳ Loading/Error States

📄 Sessions
  ├── 📋 List View
  ├── 📄 Detail View
  ├── 🔄 Sync States
  └── 📭 Empty State

📄 Settings & Shell
  ├── ⚙️ Main Settings
  ├── 🔧 Advanced Settings
  ├── 🎨 UI Scale Variants
  └── 🔘 Button Style Variants

📄 App Lifecycle
  ├── 🚀 Boot Loading
  ├── ❌ Boot Error
  ├── 🔄 Reset Flow
  └── 📲 Install States
```

---

## 📝 Design Handoff Checklist

When handing off designs to development:

### For Each Behavior
- [ ] All required states are designed
- [ ] Interactive states are clearly labeled
- [ ] Responsive breakpoints are considered
- [ ] Loading/error states are included
- [ ] Empty states are designed
- [ ] Transitions/animations are specified
- [ ] Color tokens are from design system
- [ ] Spacing uses consistent scale
- [ ] Text styles match theme.css

### For Each Screen
- [ ] Normal state
- [ ] Loading state
- [ ] Error state
- [ ] Empty state
- [ ] Mobile/tablet/desktop variants
- [ ] Icon-only vs labeled variants (if applicable)
- [ ] UI scale variants (if different)
- [ ] Debug mode variant (if applicable)

### Annotations
- [ ] Technical notes reference implementation
- [ ] State transitions are explained
- [ ] Edge cases are documented
- [ ] Settings dependencies are noted
- [ ] Activity tracking triggers are marked

---

**End of Design Specification Reference**  
*Last Updated: March 11, 2026*  
*For questions, refer to `/IMPLEMENTATION_CHECKLIST.md` for technical details*
