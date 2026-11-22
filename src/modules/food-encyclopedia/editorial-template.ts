import type { FoodDraft } from "./editorial-contracts";
export function newEditorialDraft(kind:FoodDraft["kind"]="dishes",slug="new-guide"):FoodDraft {
 return {
   kind,slug,title:"New food guide",eyebrow:"FOOD ATLAS / EDITORIAL",
   description:"A concise explanation of this food, including the context that readers should know before they order or prepare it.",
   tint:"cream",aliases:[],facts:[
      {label:"Category",value:"To be researched"},
      {label:"Tradition",value:"To be researched"},
   ],
   sections:[
      {id:"introduction",eyebrow:"01 / DEFINITION",title:"What is this food?",body:["Introduce the dish or ingredient with independently researched facts and enough detail to help a reader understand its significance."]},
      {id:"background",eyebrow:"02 / BACKGROUND",title:"Ingredients, tastes and variations",body:["Explain the typical ingredients, preparation differences and cultural context. Note important exceptions and avoid implying safety for individual restaurant servings."]},
   ],
   sourceUrls:[],relatedSlugs:[],
   caution:"Preparations and food handling vary. Ask the restaurant for details about any allergy or dietary restriction.",
 };
}
