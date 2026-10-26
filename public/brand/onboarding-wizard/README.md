# MenuMinute Super Onboarding Wizard — Mediawork Handoff

This directory is the designated drop-in target for custom SVG illustrations and icons designed for MenuMinute's 5-step Customer Onboarding Wizard.

## ChatGPT Generation Prompts & Asset Catalog

The application has a built-in `<WizardMediaSlot />` component with production-grade vector fallbacks. When custom SVG files are placed in this folder, the component automatically loads them without code changes.

### Step Hero Illustrations (`viewBox="0 0 400 240"`, Dark obsidian `#1c1917`, Amber `#f97316`)

1. **`wizard-hero-identity.svg` (Step 1: Brand & Identity)**
   > *"Create a sleek, modern, minimalist SVG illustration (viewBox 0 0 400 240, dark mode background #1c1917) showing a glowing restaurant storefront with warm amber lighting (#f97316), an elegant hanging sign, clean architectural lines, and subtle geometric accents."*

2. **`wizard-hero-location.svg` (Step 2: Location & GPS Geocoordinates)**
   > *"Create a futuristic, minimalist SVG illustration (viewBox 0 0 400 240, dark stone background #1c1917) showing an isometric geospatial map grid with glowing radar contour lines, an amber GPS pin dropping onto the map with subtle pulse ripples, and subtle latitude/longitude coordinates floating in the background."*

3. **`wizard-hero-operations.svg` (Step 3: Service & Operations)**
   > *"Create a stylish, minimalist SVG illustration (viewBox 0 0 400 240, dark stone background #1c1917) depicting a fusion of an elegant clock face, chef cloche, and coffee steam rings, rendered in warm amber (#f97316) and soft champagne lines."*

4. **`wizard-hero-contact.svg` (Step 4: Contact & Service Tables)**
   > *"Create a minimalist vector illustration (viewBox 0 0 400 240, dark stone background #1c1917) of a warm bistro dining table with an illuminated QR menu stand, two modern chairs, and subtle digital phone waves in the air."*

5. **`wizard-hero-launch.svg` (Step 5: Review & Launch Celebration)**
   > *"Create a celebratory SVG illustration (viewBox 0 0 400 240, dark stone background #1c1917) showing a golden cloche lifting to reveal a sparkling glowing QR code, surrounded by subtle amber confetti, stars, and celebratory light bursts."*

### Outlet Type Icons (`viewBox="0 0 48 48"`)
- `type-restaurant.svg`: Sophisticated fork, knife, and dining cloche.
- `type-cafe.svg`: Artisan ceramic coffee cup with delicate rising steam.
- `type-takeout.svg`: Modern kraft paper takeout bag with handles and clock emblem.
- `type-cloud-kitchen.svg`: Ghost kitchen frying pan over glowing precision flames.
- `type-hotel.svg`: Classic hotel service bell with elegant arches.
- `type-mixed.svg`: Geometric 4-quadrant dynamic hospitality badge.

---

## Technical Specifications
- Pure SVG code (`xmlns="http://www.w3.org/2000/svg"`).
- Uses MenuMinute's Amber/Stone token palette (`#f97316`, `#ea580c`, `#1c1917`, `#292524`).
- All interactive controls and text are live HTML in the React components, not rasterized inside the artwork.
