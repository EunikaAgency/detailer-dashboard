HTML slide rendering spec

HTML slides are a first-class slide type in One Detailer, separate from image and video slides.

==================================================
1. HOW AN HTML SLIDE IS DEFINED IN JSON
==================================================

An HTML slide can be authored in product media or subcase slides.

Example in product media
{
  "id": "slide-html-1",
  "type": "html",
  "url": "src/config/demo/demo-html/html-slide.html",
  "thumbnailUrl": "src/config/demo/demo-html/html-thumb.jpg",
  "title": "Interactive HTML Slide"
}

Example in subcases
{
  "type": "html",
  "src": "src/config/demo/demo-html/html-slide.html",
  "thumbnail": "src/config/demo/demo-html/html-thumb.jpg",
  "caption": "Interactive HTML Slide"
}

Accepted main source fields
- `url`
- `src`
- `path`
- `image`
- `imageUrl`
- `fileUrl`

Accepted HTML thumbnail fields
- `thumbnailUrl`
- `thumbnail`
- `thumb`
- `previewUrl`

==================================================
2. HOW SLIDE TYPE IS DETECTED
==================================================

A slide is treated as HTML when:
- `type` is `html`
- or `mimeType` is `text/html`
- or file extension is `.html`, `.htm`, or `.xhtml`

PDF is excluded.
Failed/pending/processing/error items are excluded.

==================================================
3. HOW HTML SLIDES ARE NORMALIZED
==================================================

For HTML slides:
- `sourceUrl` = normalized absolute slide URL
- `uri` = `sourceUrl` directly
- unlike image/video, HTML slide main content does not use the blob media cache path
- optional thumbnail is resolved separately as `thumbUri`

Normalized HTML slide example
{
  "id": "slide-html-1",
  "sourceUrl": "https://otsukadetailer.site/app-capacitor/src/config/demo/demo-html/html-slide.html",
  "uri": "https://otsukadetailer.site/app-capacitor/src/config/demo/demo-html/html-slide.html",
  "mediaType": "html",
  "thumbUri": "https://otsukadetailer.site/app-capacitor/src/config/demo/demo-html/html-thumb.jpg",
  "title": "Interactive HTML Slide",
  "hotspots": []
}

==================================================
4. HOW HTML SLIDES RENDER IN THE VIEWER
==================================================

HTML slides render inside an iframe, not an img tag.

Rendered structure
- slide stage container
- optional loading overlay
- iframe wrapper `.slide-html-wrap`
- iframe `#slide-html.slide-media`

Actual iframe attributes
- `src` = normalized HTML slide URL
- `title` = slide number title
- `sandbox = "allow-scripts allow-same-origin allow-forms"`

Design implication
This should look like embedded interactive content framed inside the presentation stage, not like a static screenshot.

==================================================
5. HTML SLIDE SIZING RULES
==================================================

The app tries to measure the iframe document after load.

Sizing logic
- inspect iframe document `html` and `body`
- compute scrollWidth / clientWidth / scrollHeight / clientHeight
- derive content aspect ratio
- if measurement fails, fallback ratio = 16:9

Stage fitting rules
- maxWidth = stage width - 20
- maxHeight = stage height - 20
- minWidth = 220px
- minHeight = 180px
- wrapper is centered in the stage

Result
- HTML slides are fit inside the stage while preserving detected or fallback aspect ratio
- they do not simply stretch full width like a normal webpage

==================================================
6. HTML CONTENT CENTERING
==================================================

After iframe load, the app tries to center the HTML document content.

Best-effort adjustments inside iframe
- html height = 100%
- body min-height = 100%
- body margin = 0
- body display = flex
- body align-items = center
- body justify-content = center
- body flex-direction = column
- body overflow = hidden
- child elements get max-width/max-height constraints

Important
These adjustments may fail if cross-origin restrictions or slide-authored constraints prevent DOM access.

==================================================
7. HTML LOAD / ERROR STATES
==================================================

HTML slides use the same loading overlay model as other slide types.

On load
- loading overlay is hidden
- centering/layout logic runs
- activity/debug success is logged

On error
- loading overlay changes to an error label like:
  `Image unavailable`

Design states to include
- HTML slide loading
- HTML slide loaded
- HTML slide failed/unavailable

==================================================
8. HTML SLIDE THUMBNAIL RULES
==================================================

HTML slides do NOT automatically render a live miniature of the iframe.

Thumbnail behavior:
- if `thumbnailUrl` / `thumbnail` / `thumb` / `previewUrl` exists:
  - use that image as the thumbnail
- if no thumbnail image exists:
  - show a generic placeholder tile labeled `HTML`

So there are 2 HTML thumbnail states:
1. HTML slide with image thumbnail
2. HTML slide with fallback placeholder

Example thumbnail image state
{
  "type": "html",
  "url": "src/config/demo/demo-html/html-slide.html",
  "thumbnailUrl": "src/config/demo/demo-html/html-thumb.jpg"
}

Example placeholder state
{
  "type": "html",
  "url": "src/config/demo/demo-html/html-slide.html"
}

==================================================
9. HTML THUMBNAIL VISUAL SPEC
==================================================

If thumbnail exists
- render like a normal thumb image
- show thumb loading spinner until image loads
- hide spinner on success
- show `No preview` if thumbnail image load fails

If thumbnail does not exist
- render a neutral placeholder tile
- centered text label: `HTML`
- no fake screenshot should be implied

Design implication
Figma should have both variants, not just one generic HTML thumbnail card.

==================================================
10. HTML SLIDE INTERACTION MODEL
==================================================

HTML slides can be interactive inside the iframe.

The host viewer listens for `window.postMessage` events from the HTML content.

Expected message shape
{
  "type": "detailer-demo-event",
  "action": "html_button_click",
  "details": {
    "label": "Main CTA"
  }
}

Host behavior
- receives message from iframe
- logs activity event
- enriches with:
  - deckId
  - slideIndex
  - mediaType = "html"

This means HTML slides can report:
- button clicks
- zone taps
- swipes
- slider changes
- segment selection
- long press
- other custom authored interactions

Design implication
An HTML slide is an embedded interactive mini-experience, not just a static rich-media card.

==================================================
11. HTML SLIDES VS HOTSPOTS
==================================================

JSON hotspots are only rendered for image slides in the current web viewer.
HTML slides do not use the external hotspot overlay layer.

So:
- image slide navigation uses hotspot overlay buttons
- HTML slide interaction is authored inside the HTML document itself

==================================================
12. HTML SLIDE AUTHORING RULES
==================================================

Recommended authoring rules
- use `type: "html"`
- provide a stable HTML file path/URL
- provide a dedicated thumbnail image
- keep layout self-contained
- avoid relying on unrestricted parent DOM access
- if analytics interactions matter, emit `postMessage` events to host

Recommended postMessage format
{
  "type": "detailer-demo-event",
  "action": "<event_name>",
  "details": { ... }
}

==================================================
13. WHAT FIGMA SHOULD SHOW
==================================================

Create these HTML slide variants:

1. HTML viewer loading
- same stage shell
- loading overlay visible

2. HTML viewer loaded
- framed embedded content inside stage
- looks centered and fit, not full raw browser page

3. HTML viewer error
- fallback error label in stage

4. HTML thumbnail with image preview
- standard thumb image treatment

5. HTML thumbnail placeholder
- neutral tile labeled `HTML`

Recommended annotation
“HTML slides render in a sandboxed iframe and are fit into the stage after load. They may optionally provide a preview image for the thumbnail strip; otherwise the UI shows a generic HTML placeholder.”
