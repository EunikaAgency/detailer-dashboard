Design QA Checklist

Visual System
Background uses a soft blue/slate enterprise palette, not generic white-only UI
White card surfaces are consistent across screens
Borders, radii, and shadows are consistent
Headers feel sticky/frosted and not visually disconnected
Typography hierarchy is consistent across all frames
Icons use one consistent style and stroke weight
Brand Fit
UI feels professional, medical, and operational
No consumer-social styling patterns
No flashy gradients, oversized illustrations, or playful widgets
Presentation workflow feels like the product priority
Mobile-First Layout
All key screens work at iPhone portrait width without crowding
Tap targets are large enough for thumb use
Important actions remain visible without precision tapping
Long titles or labels do not break layout
Search, chips, cards, and buttons wrap cleanly on narrow screens
Header Consistency
Each main screen has a clear top header
Left/right actions are aligned consistently
Titles are easy to identify at a glance
Back/menu behavior is visually consistent
Header height feels stable across screens
Login Screen
Login card is centered and balanced
Title/subtitle spacing is clean
Fields are clearly distinguished from buttons
Error state is visible and readable
Primary vs secondary actions are visually clear
Gallery Screen
Search is visually prominent but not oversized
Filter chips are readable and clearly selectable
Product cards are obviously tappable
Thumbnail aspect ratio feels deliberate
Optional title/category labels do not overcrowd cards
Loading, empty, and error states are all designed
Menu Screen
Menu rows feel like navigation, not random buttons
Icons and text are aligned
Spacing between rows is consistent
Install action does not overpower core navigation
Settings Screens
Settings are grouped logically
Helper text is legible and not too verbose
Segmented controls clearly show active state
Switches align cleanly with labels
Advanced screen looks more technical without feeling broken or unsafe
My Account
Read-only fields are clearly non-editable
Labels are easy to scan
Values do not overflow awkwardly
Card spacing feels calm and structured
Sessions List
Session cards are easy to compare quickly
Time, move count, duration, and status are all visible
Synced vs pending status is distinguishable without relying only on color
Empty state is handled cleanly
Session Detail
Summary appears before granular event history
Event cards are scannable
Timestamp alignment is consistent
Metadata state looks intentional, not like debug leftovers
Long event content does not break the card layout
Case Selection
It feels distinct from the gallery and more presentation-focused
Product title is clearly visible
Case cards are large and easy to tap
Case metadata is understandable at a glance
Empty/no-case state is designed
Presentation Viewer
Viewer prioritizes the slide/stage, not surrounding chrome
Title and slide count remain readable without dominating space
Thumbnail rail is useful and not too large
Active thumbnail is obvious
Prev/next controls are easy to hit
Fullscreen toggle is visible but not distracting
Orientation controls feel secondary and grouped correctly
Purge/reset utility actions do not visually compete with navigation
Presentation States
Loading overlay is visible and centered
Error state for missing media is designed
Video/HTML/image slide types all look intentional
Hotspot overlays are visible but not visually chaotic
Fullscreen and hidden-thumbnail variants still feel coherent
Tablet / Landscape Adaptation
Layout expands meaningfully on tablet
Space is used to improve clarity, not just stretch content
Viewer landscape mode feels like a primary experience
Thumbnail rail and slide stage proportions feel balanced
Accessibility / Readability
Text contrast is strong enough on all primary surfaces
Muted text remains readable
Buttons have clear active/selected states
Status colors are distinguishable with labels, not color alone
Important UI is not dependent on tiny text
Interaction Clarity
Primary action is always obvious on each screen
Secondary actions do not compete visually
Tappable cards look tappable
Back navigation is always clear
Screen purpose is immediately understandable within 2 seconds
System Completeness
Login, loading, error, empty, success, and recovery states all exist
Install/help states exist
Session synced/pending variants exist
Presentation viewer variants exist for portrait and landscape
Boot failure / recovery state exists and matches the design system
Implementation Fit
Nothing in the design requires desktop-only interactions
Layout matches a browser-based PWA, not a native-only app
Controls are realistic for HTML/CSS implementation
Screen states align with the actual app flow