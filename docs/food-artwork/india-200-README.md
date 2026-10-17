# Menu-Minute: India 200 dish illustration backlog

A curated editorial shortlist of 200 **new** candidates for original Ink & Ember food artwork.
IDs `MM-IN-001` through `MM-IN-200` are stable production IDs, **not a nationwide sales ranking**.
Regional associations do not claim exclusive origin or historic birthplace.

## Files

- [CSV](india-200-dish-backlog.csv) — easy to filter and import.
- [JSON](india-200-dish-backlog.json) — machine-readable, with the 36-item exclusion set.
- [Standalone validator](../../scripts/food-artwork/verify-india-backlog.mjs) — checks the exports.

## Coverage

- North / Punjab / Kashmir: 20.
- North / Central / Awadh / Rajasthan: 20.
- Tamil Nadu / Karnataka: 20.
- Kerala / Andhra Pradesh / Telangana: 20.
- Maharashtra / Gujarat / Goa: 20.
- Bengal / Odisha / Bihar / Jharkhand: 20.
- Northeast / Himalayan India: 20.
- Indo-Chinese starters: 25.
- Indo-Chinese mains and soups: 15.
- Sweets and desserts: 20.

**Total: 200**; provisional recipe hints: 136 vegetarian, 59 non-vegetarian, two egg-based
and three recipe-dependent.

## Excluded existing artwork

These 36 illustrations are already in [draft PR #4](https://github.com/baba-dev/menuminute/pull/4)
and its [review gallery](https://github.com/baba-dev/menuminute/blob/feat/approved-dish-artwork-review/docs/food-artwork/gallery.md).

- Indian (12): Biryani, Butter Chicken, Masala Dosa, Idli Sambar, Paneer Tikka, Samosa,
  Chole Bhature, Rajma Chawal, Naan, Dal Tadka, Vada Pav, Gulab Jamun.
- Western (12): Burger, Steak, Sandwich, Caesar Salad, Fried Chicken, French Fries, Pancakes,
  Hot Dog, Mac & Cheese, Grilled Fish, Donut, Milkshake.
- Italian (12): Pizza Margherita, Spaghetti, Penne Alfredo, Lasagna, Risotto, Ravioli,
  Bruschetta, Gnocchi, Caprese Salad, Focaccia, Tiramisu, Gelato.

The prior generic food concept pack also informed selection; this shortlist uses specific
named preparations. The explicit exclusion validator checks PR #4's 36 dish keys, not a
merchant's uploaded images or any unenumerated personal assets.

## Dataset fields

- `id`: stable sequence ID, not popularity rank.
- `dish_name`: canonical English title for the artwork task.
- `slug`: unique asset key and future filename.
- `collection`: production batch / broad cuisine grouping.
- `regional_association`: illustrative geographical association, not exclusive origin.
- `category`: presentation role such as main, starter, street_food, snack, bread, or dessert.
- `dietary_hint`: provisional recipe type only.
- `visual_anchor`: distinctive appearance for a faithful food illustration.
- `illustration_status`: always `not_created` in this backlog.

**Do not publish dietary hints as verified merchant claims.** Actual ingredients, egg content,
allergens, cross-contact and religious certification require each restaurant's confirmation.

## Subsequent artwork direction

Match the approved illustrated dish sheets: warm flat colors, dark outlines, food-specific
details, no rendered words inside artwork, and transparent backgrounds. Review the icons on
`#FFFFFF` and `#111111` surfaces; pale foods need visible outer contours. The restaurant
owner's media choices always take precedence. No images or menu runtime changes are in this PR.

Source material used for breadth and menu examples, **not nationwide popularity statistics**:

- [Incredible India: Food and Cuisine](https://www.prod.incredibleindia.gov.in/content/incredible-india-v2/en/experiences/food-and-cuisine.html).
- [National Portal of India: Culinary overview](https://www.india.gov.in/explore-india).
- [Assam Tourism: Cuisine](https://assamtourism.gov.in/cuisine.php).
- [NDTV Food: Indo-Chinese starters](https://food.ndtv.com/food-drinks/craving-for-indo-chinese-style-starters-heres-your-to-try-list-2618351).

Run from the repository root:

```sh
node scripts/food-artwork/verify-india-backlog.mjs
```
