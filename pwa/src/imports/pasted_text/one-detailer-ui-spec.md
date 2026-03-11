Create a complete mobile-first PWA UI system and app flow for an enterprise medical presentation app called One Detailer.

Overall visual direction:
Clean enterprise-medical aesthetic. Calm, credible, practical, and polished. Use a soft blue/slate palette with white surfaces, subtle blue-gray gradient backgrounds, frosted or semi-translucent sticky headers, light borders, rounded 10-12px corners, soft shadows, compact spacing, and touch-friendly controls. Typography should be readable and restrained, optimized for field use on phones and tablets. Avoid playful startup styling, bold marketing visuals, or consumer-social patterns. This is a focused tool for professional reps showing presentation content.

Create these mobile screens and components:

1. Login screen
A full-height centered layout on a pale blue gradient background. One centered white card with the brand title “One Detailer”, subtitle “Sign in to continue”, two stacked input rows with small prefix labels “User” and “Pass”, a remember credentials checkbox, optional inline error banner, primary button “Sign in”, and secondary ghost button “Quick access”. Keep the structure simple and reassuring.

2. Presentation gallery screen
Sticky translucent top header. Left side menu icon button. Centered title with an image/gallery icon and text “Presentations”. Right side action buttons for sync and logout. Below the header, a search field with a compact label chip, then a row of filter chips for categories. Main body is a responsive grid of white presentation cards with large thumbnails, optional presentation title, and category pill. Cards must feel highly tappable and work as a 2-column mobile grid that expands on tablet.

3. Gallery loading state
Same header and search/filter structure as the presentation gallery, but replace cards with skeleton or shimmer placeholders. Each placeholder card includes a centered message like “Fetching content from the internet...” and a short subtitle. The layout should remain stable to reduce perceived jank.

4. Menu screen
Sticky header with title “Menu” and a back button. Main content is a narrow centered stack of large full-width tappable white menu rows with icons. Include: My Account, Sessions, Settings, and Install App / How To Install. Minimal and easy to scan.

5. Settings screen
Sticky header with title “Settings” and back button. Main content is a centered white card with grouped appearance controls. Each setting row has a bold label, muted helper text, and a control aligned right. Include:
- Product labels shown / hidden segmented control
- Button style icons only / labels segmented control
- Gallery columns segmented control with values 1 to 4
- Interface size segmented control with Small / Medium / Large
- Dynamic slide background fill switch
At the bottom, include a large row button leading to Advanced settings.

6. Advanced settings screen
Sticky header with title “Advanced” and back button. Main content is a vertical stack of white cards.
- A warning-emphasis card with light red border titled “Factory Reset Cache”, muted explanation, and primary action button “Reset & Recache”
- A toggle card for “Show hotspot areas”
- A toggle card for “Debug Mode”
- A diagnostics logs card showing rows for Session, File, Entries, and Retention, with actions “Copy log” and “Download log”
The overall feel should stay professional and technical, not alarming.

7. My Account screen
Sticky header with title “My Account” and back button. A single white card with stacked read-only fields. Each field uses a small label and an input-style read-only box. Include:
- Representative Name
- Username
- Issued login username
- Rep ID
- Role

8. Sessions list screen
Sticky header with title “Sessions” and back button. Intro copy explains that moves are grouped by session. Main content is a vertical list of large session cards. Each card shows:
- Session title
- Time range
- Move count
- Duration pill
- Status badge: Synced or Pending
Use green-tinted treatment for synced and muted amber/warm treatment for pending.

9. Session detail screen
Sticky header with title “Session Details” and back button. Top summary card includes session title, time range, move count, duration, and sync status. Below that, a “Session Summary” card. Then a vertical list of event cards, each with bold event title, small timestamp aligned right, muted subtitle, and optional expandable metadata block. This should feel like an audit trail.

10. Case selection screen
After choosing a presentation, show a more immersive interface. Slim top header with left menu icon, centered product title, and right back button. Main content shows heading “Select Case” and a stack of case cards. Each case card contains a circular person-style icon, case title, slide count, and estimated duration in minutes. This screen should feel more focused and presentation-oriented than the gallery.

11. Presentation viewer screen
Create a professional immersive presentation interface.
- Top bar with left menu button, centered deck title, subtitle like “Slide 3 of 18”, and right back button
- Floating fullscreen toggle
- Thumbnail strip that can appear on the side or bottom depending on layout
- Highlighted active thumbnail
- Large centered slide stage with soft dynamic backdrop fill
- Loading overlay for slide fetch state
- Previous and next navigation buttons
- Optional orientation controls: Auto, Portrait, Landscape
- Support screen variants for image slide, video slide, and HTML slide
The viewer should feel like a serious field presentation tool, not a generic slideshow app.

12. Presentation viewer with hotspots
Same as the main viewer, but the current image slide contains visible translucent blue hotspot rectangles with borders, representing interactive navigation zones for debug/training mode.

13. Boot/loading screen
Very minimal full-screen state with centered message “Preparing your presentation...” on a clean pale background. Quiet and branded, no clutter.

14. Boot failure / recovery screen
Full-screen recovery state with centered title “One Detailer could not start” or “One Detailer is not loading”, muted explanation text, and two actions:
- Reload app
- Reset cached data
The design should be supportive and calm.

Design system guidance:
- Mobile-first iPhone width base frame, plus tablet adaptations
- Use consistent sticky headers across all app screens
- Prefer rounded white cards on pale gradient backgrounds
- Use segmented controls, chips, toggles, and icon buttons consistently
- Keep spacing compact but not cramped
- Use icon-led enterprise UI, not decorative illustrations
- Build for both portrait phone usage and landscape presentation usage
- Include components for cards, pills, segmented controls, icon buttons, switches, thumbnail states, loading overlays, error banners, and read-only fields

Create frames for:
- iPhone mobile screens
- iPad / tablet adaptations
- Presentation viewer landscape mode
- Core reusable component set

Preserve one coherent visual system across all screens.
