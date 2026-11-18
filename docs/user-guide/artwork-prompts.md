# User Guide artwork prompts

Use these with any image generator. Generate each at **1536 × 1024 px (3:2 landscape)**, the same shape as the
brochure cover band. Save as `public/guide/art/chapter-00.jpg` … `chapter-11.jpg` (JPG, quality 90, sRGB). Until a
file exists, the guide shows a branded placeholder for that chapter.

## Rules for every image

- No text, letters, numbers, logos, signboards, menus with readable words or screens with readable UI. The guide adds all text.
- No scannable QR codes. Where a QR stand appears, show a plain cream card with a blank centre or an abstract pattern only.
- Same cast across chapters: **Meera** (owner, 40s, red-brown apron, kajal, gold jhumkas, confident smile), **Rafiq** (chef, 30s, white chef cap, short beard), **Anil** (young waiter, maroon kurta), **Sana** (young guest, mustard dupatta) and **Dev** (young guest, glasses, purple shirt).
- Do not show real brands, real restaurants, real people's likeness or any health or allergy claims.
- Keep the lower 12% of the frame calm (no key detail). The guide places an orange caption bar there.

## Shared style block (paste at the start of every prompt)

> Warm hand-painted gouache and digital illustration, editorial storybook style, rich visible brush texture and paper grain, soft golden-hour light with dappled leaf shadows, cosy modern Indian restaurant, colour palette of cream (#FFF6E8), terracotta, deep brick red, saffron orange (#E8502A), marigold yellow, bottle green and plum, brass lamps, carved arches, cane chairs, green and white patterned tiles, lush indoor plants, steam rising from food, genuine warm smiles, diverse everyday Indian people, detailed but uncluttered, 3:2 landscape, no text, no logos, no letters or numbers anywhere.

## Prompts

**00. Cover: "Welcome to MenuMinute"**
[Shared style block] Wide view of a bustling, happy neighbourhood restaurant at lunch. In the foreground left, Meera, the owner, stands arms crossed at the counter with a proud smile. Behind her, Rafiq the chef carries a steaming plate of curry. At the right table, Sana and Dev look at a phone together beside a small blank cream table-stand card, with a basket of naan and a bowl of paneer curry. A big arched window glows with sunlight and bougainvillea. Brass pendant lamps overhead.

**01. Chapter 1: "Welcome: what MenuMinute does"**
[Shared style block] Flat-lay-meets-scene: a large wooden restaurant counter seen at a slight angle with a tablet, a phone, a small brass bell, a notepad and a cup of chai. Above, softly floating around like a gentle mind-map, four painted vignettes in rounded frames: a menu card, a QR table-stand, a kitchen pass with plates, a bar chart on a wall poster (no numbers). Meera smiling at the counter.

**02. Chapter 2: "Sign up and set up your restaurant"**
[Shared style block] Early morning, the restaurant before opening. Meera unlocks the glass door and flips a blank wooden sign. She holds a phone, with sunlight flooding in across empty tables and chairs. A framed blank signboard being hung, a box of fresh marigolds and a potted plant by the door. Feeling: a new beginning.

**03. Chapter 3: "Build your menu"**
[Shared style block] Close, appetising food scene on a long marble table: thali, paneer tikka skewers, dosa, biryani in a brass handi, gulab jamun and masala chai, with fresh herbs and spices scattered. Meera and Rafiq lean in to photograph a dish with a phone, ring light glow. A hand-painted paper menu with blurred scribbles (no readable words) sits beside a tablet.

**04. Chapter 4: "QR codes"**
[Shared style block] A restaurant table close-up in warm light: a brass table-stand holding a plain cream card with an abstract blank pattern (no real QR), a steel tumbler, marigold flowers in a small vase. Anil carefully places the stand on the table while a guest's hand holds up a phone at it. Soft bokeh of the dining hall behind.

**05. Chapter 5: "The guest experience"**
[Shared style block] Sana and Dev at a window table, delighted, browsing on a phone, with a thali and butter naan in front of them. The phone shows only a blurred colourful food-photo grid (no readable text). Plants, arched window, a hint of the street outside. Cosy, happy mood.

**06. Chapter 6: "Taking orders"**
[Shared style block] Anil at the counter taps a tablet while a guest hands over a phone to show their order; a small brass bell and a stack of takeaway boxes nearby. Behind, the open kitchen window with Rafiq. Busy but calm, friendly eye contact, colourful tiles.

**07. Chapter 7: "Kitchen board"**
[Shared style block] Inside a clean professional Indian kitchen at the pass. A wall-mounted screen with abstract coloured cards (green, amber, red blocks, no text). Rafiq plates a dish under a heat lamp with flames from the tandoor behind him; two cooks work at the wok station with golden steam and sparks. Anil waits to take plates out.

**08. Chapter 8: "Tables and floor"**
[Shared style block] A gentle high-angle view of the whole dining floor, showing round and square tables of different sizes with cane chairs, some occupied with families and friends, some empty and set with brass tumblers. Meera walks through with a tablet. Patterned tile floor, hanging plants, warm lamps.

**09. Chapter 9: "Reports"**
[Shared style block] Evening after service: Meera sits at a corner table with a cup of chai and a tablet, smiling at a colourful, abstract bar and line chart shown without any numbers or labels. A notebook, a calculator and a stack of closed takeaway boxes beside her. Lamps glow, the empty restaurant looks content.

**10. Chapter 10: "Team and settings"**
[Shared style block] Meera, Rafiq and Anil standing together in a friendly group at the restaurant entrance, wearing their work clothes, with each holding a role-defining prop (a tablet, a ladle, a serving tray). The restaurant sign is a blank wooden board overhead. Warm sunset light, a feeling of teamwork.

**11. Chapter 11: "Troubleshooting, glossary and help"**
[Shared style block] Meera on a phone call at the counter with a reassuring smile, a second hand holding a cup of chai, a small brass bell and a green plant next to her. On the counter, a phone showing a blank green chat bubble shape (no text). Soft warm background of the dining room.

## Back cover (optional, same 3:2)

**12. Thank you**
[Shared style block] Golden-hour exterior of the restaurant from the street: a carved wooden door, string lights, marigold garlands, a blank hanging signboard, Meera waving from the doorway, a few guests walking in.

## Delivery checklist

1. Check hands, faces and cutlery for errors; regenerate if odd.
2. Make sure no readable text appears anywhere. If it does, regenerate or paint it out.
3. Name files exactly `chapter-00.jpg` … `chapter-12.jpg` and put them in `public/guide/art/`.
