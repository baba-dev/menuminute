export const regions =
  "AE AF AL AM AO AR AT AU AZ BA BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CY CZ DE DJ DK DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GM GN GR GT HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KM KR KW KZ LA LB LC LK LR LS LT LU LV LY MA MD ME MG MK ML MM MN MR MT MU MV MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PT PY QA RO RS RU RW SA SC SD SE SG SI SK SL SN SO SR SV SY SZ TD TG TH TJ TL TN TR TT TW TZ UA UG US UY UZ VE VN YE ZA ZM ZW".split(
    " "
  );
export const currencyFor: Record<string, string> = {
  AE: "AED",
  AU: "AUD",
  BD: "BDT",
  BH: "BHD",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  DE: "EUR",
  EG: "EGP",
  FR: "EUR",
  GB: "GBP",
  HK: "HKD",
  ID: "IDR",
  IN: "INR",
  JP: "JPY",
  KE: "KES",
  KR: "KRW",
  KW: "KWD",
  MY: "MYR",
  NG: "NGN",
  NL: "EUR",
  NP: "NPR",
  NZ: "NZD",
  OM: "OMR",
  PH: "PHP",
  PK: "PKR",
  QA: "QAR",
  SA: "SAR",
  SG: "SGD",
  TH: "THB",
  TR: "TRY",
  TZ: "TZS",
  US: "USD",
  VN: "VND",
  ZA: "ZAR",
};
export function localeOptions(locale = "en") {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return regions
    .map((code) => ({ code, label: names.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}
export function timezoneOptions() {
  return [...new Set(["UTC", "Asia/Kolkata", ...Intl.supportedValuesOf("timeZone")])].sort();
}
