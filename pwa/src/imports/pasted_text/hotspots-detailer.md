Hotspots in One Detailer

Hotspots are interactive regions placed on image slides. They let the presenter tap a defined area of the current slide and jump to another slide in the same deck.

Important behavior
- Hotspots are data-driven from slide JSON
- They are rendered only for image slides
- They navigate by linking to another slide in the same deck
- They stay clickable even when hotspot outlines are visually hidden
- “Show hotspot areas” is a visual debug/training toggle, not the core interaction itself

==================================================
1. WHERE HOTSPOTS LIVE IN JSON
==================================================

Hotspots are attached to individual slides.

Example inside a product media group
{
  "_id": "prod-001",
  "name": "Abilify Maintena",
  "media": [
    {
      "groupId": "abilify-maintena-hcp-overview",
      "title": "HCP Overview",
      "items": [
        {
          "id": "slide-1",
          "type": "image",
          "url": "src/assets/abilify-slide-1.jpg",
          "title": "Introduction"
        },
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
        },
        {
          "id": "slide-5",
          "type": "image",
          "url": "src/assets/abilify-slide-5.jpg",
          "title": "Efficacy Summary"
        }
      ]
    }
  ]
}

You can also have hotspots in subcase slides
{
  "subcases": [
    {
      "id": "hcp-overview",
      "title": "HCP Overview",
      "slides": [
        {
          "type": "image",
          "src": "src/assets/slide-2.jpg",
          "hotspots": [
            {
              "x": 0.12,
              "y": 0.18,
              "w": 0.20,
              "h": 0.16,
              "shape": "rect",
              "targetPageId": "src/assets/slide-5.jpg"
            }
          ]
        }
      ]
    }
  ]
}

==================================================
2. HOTSPOT FIELD DEFINITIONS
==================================================

Each hotspot supports:

- `id`
  Optional unique hotspot id

- `x`
  Left position as a normalized fraction of the rendered image width
  Example: `0.12` = 12% from the left edge

- `y`
  Top position as a normalized fraction of the rendered image height
  Example: `0.18` = 18% from the top edge

- `w`
  Width as a normalized fraction of the rendered image width
  Example: `0.20` = 20% of the image width

- `h`
  Height as a normalized fraction of the rendered image height
  Example: `0.16` = 16% of the image height

- `shape`
  Currently treated as `"rect"` in the UI flow
  You may store the value, but the current web implementation draws rectangular hit areas

- `targetPageId`
  Required link target
  This should match the target slide’s source URL/path after normalization

Important implementation note
These values are not pixel coordinates. They are proportional values relative to the displayed image.

==================================================
3. HOW TARGETING WORKS
==================================================

The app does not hardcode a numeric slide index in JSON.

Instead:
- each slide has a normalized `sourceUrl`
- each hotspot has `targetPageId`
- the app resolves `targetPageId` into the slide’s actual deck index

Runtime mapping logic
- build all slides in a deck
- create a sourceUrl -> slideIndex map
- for each hotspot:
  - normalize `targetPageId`
  - look up matching slide index
  - if target is missing, discard the hotspot

Resulting normalized hotspot object
{
  "id": "hs-1",
  "x": 0.12,
  "y": 0.18,
  "w": 0.20,
  "h": 0.16,
  "shape": "rect",
  "targetIndex": 4
}

Design implication
Figma should describe hotspot navigation as:
“tap region on slide -> app jumps to another slide in same deck”

==================================================
4. HOW HOTSPOTS ARE RENDERED
==================================================

Hotspots are placed on top of the rendered image inside the slide stage.

Implementation model
- wait until image is loaded
- measure rendered image rectangle inside the stage
- multiply hotspot x/y/w/h by rendered image width/height
- place absolutely positioned button overlays on top of the image

Positioning formula
left = imageLeft + (x * imageWidth)
top = imageTop + (y * imageHeight)
width = w * imageWidth
height = h * imageHeight

Important
Hotspots are aligned to the displayed image bounds, not the whole stage container. This matters because slides use `object-fit: contain`, so empty margins may exist around the image.

==================================================
5. WHEN HOTSPOTS APPEAR
==================================================

Hotspots are only meaningful on image slides.

Current behavior
- image slide: hotspot layer rendered
- video slide: no hotspot overlay
- html slide: no hotspot overlay

If a slide has no valid hotspots
- no interactive regions are shown

If hotspot target is invalid
- hotspot is dropped during normalization

==================================================
6. SHOW HOTSPOTS SETTING
==================================================

Advanced Settings includes:
- “Show hotspot areas”

What it does
- toggles whether hotspot rectangles are visibly outlined/fill-highlighted
- this is primarily for debug/training/demo visibility

Important UX detail
- even when outlines are hidden, hotspot buttons remain clickable
- “hide hotspots” means “hide visual markers,” not “disable hotspot navigation”

Design implication for Figma
Create two viewer states:
1. Normal presentation mode
   - no visible hotspot outlines
   - hotspots still work invisibly
2. Hotspot debug/training mode
   - translucent blue rectangular overlays visible
   - user can understand tappable areas

==================================================
7. HOTSPOT INTERACTION BEHAVIOR
==================================================

When a hotspot is tapped
- app tracks an activity event like:
  `hotspot_tapped`
- includes:
  - deckId
  - fromIndex
  - toIndex
- app navigates to the target slide

Example tracked event
{
  "eventType": "activity",
  "action": "hotspot_tapped",
  "screen": "presentation",
  "method": "password",
  "source": "online",
  "details": {
    "deckId": "abilify-maintena-hcp-overview",
    "fromIndex": 1,
    "toIndex": 4
  }
}

==================================================
8. WHAT FIGMA SHOULD SHOW
==================================================

For the Presentation Viewer, include these hotspot variants:

1. Viewer default
- normal slide
- hotspot regions invisible
- tap behavior implied via annotation

2. Viewer with hotspot debug on
- translucent blue hotspot rectangles
- subtle border and fill
- clearly shows tappable areas

3. Viewer hotspot navigation concept
- annotate that tapping a hotspot jumps to another slide in the same deck

Recommended annotation text
“Hotspots are data-driven tappable regions placed on image slides. Their coordinates are normalized against the rendered image. `targetPageId` resolves to another slide in the same deck.”

==================================================
9. RECOMMENDED JSON RULES FOR CONTENT AUTHORS
==================================================

Use these rules when authoring hotspot data:
- hotspot coordinates should be normalized decimals from 0 to 1
- keep hotspots within image bounds
- use `targetPageId` that matches an actual slide source in the same deck
- prefer `shape: "rect"` for current implementation
- only add hotspots to image slides

Good example
{
  "x": 0.68,
  "y": 0.22,
  "w": 0.18,
  "h": 0.12,
  "shape": "rect",
  "targetPageId": "src/assets/slide-8.jpg"
}

Bad example
{
  "x": 240,
  "y": 100,
  "w": 120,
  "h": 80,
  "targetPageId": "non-existent-slide.jpg"
}

Why bad
- uses pixel values instead of normalized values
- target slide may not exist

==================================================
10. SHORT FIGMA STICKY NOTE
==================================================

“Hotspots are JSON-driven interactive regions on image slides. Coordinates are normalized (0..1) against the rendered image, and `targetPageId` links to another slide in the same deck. ‘Show hotspot areas’ reveals the clickable regions visually but does not define the interaction itself.”
