// Explicit, editorially checked common Hindi/Arabic terms. Preserve unrecognized Unicode
// tokens verbatim; never approximate translations or derive nutritional information.
const translations: Record<string, string> = {
  पनीर: "paneer",
  मसाला: "masala",
  टिक्का: "tikka",
  बिरयानी: "biryani",
  बिरयानीं: "biryani",
  दाल: "dal",
  चावल: "chawal",
  समोसा: "samosa",
  चाय: "chai",
  छोले: "chole",
  भटूरे: "bhature",
  आलू: "aloo",
  डोसा: "dosa",
  मक्खनी: "makhani",
  नान: "naan",
  पिज़्ज़ा: "pizza",
  शाही: "shahi",
  कड़ाही: "kadai",
  بانير: "paneer",
  بانيير: "paneer",
  برياني: "biryani",
  بريانـي: "biryani",
  ماسالا: "masala",
  تيكا: "tikka",
  سمبوسة: "samosa",
  شاي: "chai",
  بيتزا: "pizza",
  شاورما: "shawarma",
  دال: "dal",
  نان: "naan",
};
export function normalizeDishText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640\u200c\u200d]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => translations[token] ?? token)
    .join(" ");
}
