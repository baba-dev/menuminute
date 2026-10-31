import { projectMenu } from "./projector";
import { isVerifiedFreeFrom } from "./culinary-safety";
import type { PublicProduct } from "./service";
import type { ConciergePreferences, ConciergeRecommendation } from "./concierge-contracts";

export type MealRole = "starter" | "main" | "side" | "drink" | "dessert";
export type MealCandidate = {
  dishId: string;
  menuId: string;
  name: string;
  category: string;
  role: MealRole;
  priceMinor: number;
  heat: number | null;
  flavors: string[];
  dietary: string[];
};
export type MealItem = { dishId: string; quantity: number };

/** Menu categories are merchant-authored. Role classification is suggestive, not safety-critical. */
export function mealRole(category: string, name: string): MealRole {
  const text = (category + " " + name).toLowerCase();
  if (/dessert|sweet|mithai|ice cream|pastry|cake|pudding|gulab|jalebi/.test(text)) return "dessert";
  if (/drink|beverage|juice|shake|lassi|coffee|tea|chai|smoothie|soda/.test(text)) return "drink";
  if (/bread|naan|roti|paratha|kulcha|accompaniment|sides|rice|pulao/.test(text)) return "side";
  if (/starter|snack|appetizer|tandoor|tikka|samosa|pakora|chaat|fries/.test(text)) return "starter";
  return "main";
}

/** A budget must include the cheapest *available* variant and every mandatory addon. */
export function minimumDishPrice(dish: {
  priceMinor: number;
  variants: readonly { priceMinor: number; isAvailable: boolean }[];
  addOnGroups: readonly { min: number; options: readonly { priceMinor: number; isAvailable: boolean }[] }[];
}): number | null {
  const variants = dish.variants.filter((option) => option.isAvailable);
  if (dish.variants.length && !variants.length) return null;
  let total = variants.length ? Math.min(...variants.map((v) => v.priceMinor)) : dish.priceMinor;
  for (const group of dish.addOnGroups) {
    const available = group.options.filter((option) => option.isAvailable).map((option) => option.priceMinor).sort((a,b) => a-b);
    if (available.length < group.min) return null;
    total += available.slice(0,group.min).reduce((sum,value) => sum+value,0);
  }
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

export function candidatesForMenu(data: PublicProduct, preferences: ConciergePreferences): MealCandidate[] {
  const output: MealCandidate[] = [];
  const seen = new Set<string>();
  const avoid = preferences.avoid.split(/[,;]/).map((term) => term.trim().toLocaleLowerCase()).filter(Boolean);
  for (const menu of data.menus) {
    const view = projectMenu(menu.document, data.outlet.timezone, new Date(data.now), menu.overrides);
    for (const category of view.categories) {
      for (const dish of category.items) {
        if (dish.soldOut || !dish.open || seen.has(dish.id)) continue;
        if (preferences.diet === "vegetarian" && !dish.dietary.includes("vegetarian") && !dish.dietary.includes("vegan")) continue;
        if (preferences.diet === "vegan" && !dish.dietary.includes("vegan")) continue;
        // A missing ingredient declaration is unknown, not confirmation that a dish is safe.
        if (preferences.diet === "gluten_free" && (!dish.dietary.includes("gluten_free") || dish.safety?.verified !== true || Boolean(dish.safety.crossContact))) continue;
        if (preferences.diet === "nut_free" && !isVerifiedFreeFrom(dish, "nuts")) continue;
        if (preferences.diet === "dairy_free" && !isVerifiedFreeFrom(dish, "dairy")) continue;
        if (avoid.length && (!dish.safety?.verified || !dish.safety.ingredients.length ||
          avoid.some((term) => (dish.name + " " + dish.safety!.ingredients.join(" ")).toLocaleLowerCase().includes(term)))) continue;
        const heat = dish.culinary?.spiceLevel ?? null;
        if (preferences.spice === "mild" && heat !== null && heat > 1) continue;
        if (preferences.spice === "medium" && heat !== null && heat > 2) continue;
        if (preferences.spice === "hot" && heat !== null && heat < 2) continue;
        const priceMinor = minimumDishPrice(dish);
        if (priceMinor === null || (preferences.budgetMinor > 0 && priceMinor > preferences.budgetMinor)) continue;
        seen.add(dish.id);
        output.push({
          dishId: dish.id, menuId: menu.id, name: dish.name, category: category.name,
          role: mealRole(category.name,dish.name), priceMinor, heat,
          flavors: (dish.culinary?.flavorNotes ?? []).slice(0,6), dietary: dish.dietary.slice(0,3),
        });
      }
    }
  }
  return output;
}

export function estimateSubtotal(items: readonly MealItem[], candidates: readonly MealCandidate[]): number | null {
  const lookup = new Map(candidates.map((dish) => [dish.dishId, dish]));
  let total = 0;
  for (const item of items) {
    const found = lookup.get(item.dishId);
    if (!found || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 12) return null;
    total += found.priceMinor * item.quantity;
  }
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

export function validMeal(items: readonly MealItem[], candidates: readonly MealCandidate[], preferences: ConciergePreferences): boolean {
  if (!items.length || items.length > 12 || new Set(items.map((item) => item.dishId)).size !== items.length) return false;
  const subtotal = estimateSubtotal(items,candidates);
  if (subtotal === null || (preferences.budgetMinor && subtotal > preferences.budgetMinor)) return false;
  const roles = items.map((item) => candidates.find((candidate) => candidate.dishId === item.dishId)?.role);
  if (preferences.mode === "bite" && items.length > 2) return false;
  if (preferences.mode === "single" && items.length > 3) return false;
  return roles.every(Boolean);
}

function grade(candidate: MealCandidate, preferences: ConciergePreferences): number {
  let score = 0;
  const note = (candidate.name + " " + candidate.flavors.join(" ")).toLowerCase();
  if (preferences.mood === "bold" && (candidate.heat ?? 0) >= 2) score += 7;
  if (preferences.mood === "fresh" && /fresh|salad|fruit|light|grill|soup/.test(note)) score += 6;
  if (preferences.mood === "comfort" && /butter|creamy|warm|dal|rice|paneer|comfort/.test(note)) score += 6;
  if (preferences.mood === "indulgent" && /rich|cheese|cream|butter|chocolate/.test(note)) score += 6;
  if (preferences.mood === "quick" && /wrap|sandwich|snack|roll|bowl/.test(note)) score += 5;
  if (preferences.craving && note.includes(preferences.craving.toLowerCase().trim())) score += 12;
  if (preferences.refinement && note.includes(preferences.refinement.toLowerCase().trim())) score += 12;
  return score;
}

/** A zero-cost deterministic fallback is always available; it never calls Cloudflare. */
export function curatedMeals(candidates: readonly MealCandidate[], preferences: ConciergePreferences): ConciergeRecommendation[] {
  if (!candidates.length) return [];
  const byRole = (role: MealRole, offset: number) =>
    candidates.filter((dish) => dish.role === role).sort((a,b) =>
      grade(b,preferences)-grade(a,preferences) || a.priceMinor-b.priceMinor || a.dishId.localeCompare(b.dishId)
    ).slice(offset);
  const labels = ["Your best match","An alternative to savour","A little adventure"];
  const choices: ConciergeRecommendation[] = [];
  for (let offset=0; offset<3; offset++) {
    const included: MealItem[] = [];
    const budget = preferences.budgetMinor || Number.MAX_SAFE_INTEGER;
    const add = (role: MealRole, count: number) => {
      for (const candidate of byRole(role,offset)) {
        if (included.some((item) => item.dishId===candidate.dishId)) continue;
        let quantity = count;
        while (quantity>0 && (estimateSubtotal(included,candidates) ?? 0)+candidate.priceMinor*quantity>budget) quantity--;
        if (quantity===0) continue;
        included.push({dishId:candidate.dishId,quantity}); return true;
      }
      return false;
    };
    if (preferences.mode === "bite") {
      if (!add("starter",Math.min(preferences.guests,3))) add("main",1);
    } else {
      if (preferences.mode === "feast") add("starter",Math.max(1,Math.ceil(preferences.guests/2)));
      if (!add("main",preferences.guests)) add("starter",preferences.guests);
      if (preferences.mode === "feast") {
        add("side",Math.max(1,Math.ceil(preferences.guests/2)));
        add("drink",preferences.guests);
        add("dessert",Math.max(1,Math.ceil(preferences.guests/2)));
      }
    }
    // A single-dish fallback is better than inventing a full meal or exceeding the budget.
    if (!included.length || !validMeal(included,candidates,preferences)) continue;
    const signature = included.map((item) => item.dishId).join(",");
    if (choices.some((previous) => previous.items.map((item) => item.dishId).join(",") === signature)) continue;
    choices.push({
      title: labels[offset]!, introduction: "Chosen from the restaurant's available dishes to suit your table.",
      items: included,
    });
  }
  return choices;
}

export function verifyRecommendations(
  raw: readonly ConciergeRecommendation[], candidates: readonly MealCandidate[], preferences: ConciergePreferences
): ConciergeRecommendation[] {
  const valid: ConciergeRecommendation[] = [];
  const signatures = new Set<string>();
  for (const recommendation of raw) {
    if (!validMeal(recommendation.items,candidates,preferences)) continue;
    const signature = recommendation.items.map((item)=>item.dishId).sort().join(":");
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    valid.push(recommendation);
    if (valid.length===3) break;
  }
  return valid;
}
