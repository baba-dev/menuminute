/** Chapter 11 (help, glossary, contact) and the back cover of the bilingual User Operation Guide. */
import type { Bi } from "./content";

export const CH11 = {
  no: 11,
  title: { en: "Help and troubleshooting", hi: "मदद और समस्या का हल" } as Bi,
  tagline: {
    en: "Stuck? You are never alone. Message us any time.",
    hi: "अटक गए? आप अकेले नहीं हैं। कभी भी हमें मैसेज कीजिए।",
  } as Bi,
  learn: [
    { en: "Fix the most common problems yourself", hi: "आम समस्याएँ ख़ुद ठीक कीजिए" },
    { en: "Understand the words used in the app", hi: "ऐप के शब्दों का मतलब समझिए" },
    { en: "Know how to reach us quickly", hi: "हमसे जल्दी संपर्क करना जानिए" },
  ] as Bi[],
  fixTitle: { en: "Quick fixes", hi: "फटाफट हल" } as Bi,
  fixes: [
    {
      q: { en: "I can't sign in.", hi: "मैं साइन इन नहीं कर पा रहा/रही।" },
      a: {
        en: "Check your email and password. Make sure you verified your email. Use Forgot your password? if needed.",
        hi: "ईमेल और पासवर्ड ठीक से देखिए। ईमेल वेरिफ़ाई किया है या नहीं, देखिए। ज़रूरत हो तो Forgot your password? इस्तेमाल कीजिए।",
      },
    },
    {
      q: {
        en: "Guests can't see my new dish or price.",
        hi: "ग्राहकों को मेरी नई डिश या कीमत नहीं दिख रही।",
      },
      a: {
        en: "Publish your menu: Publish menu, then Confirm publication. Changes stay private until you do.",
        hi: "मेन्यू पब्लिश कीजिए: Publish menu, फिर Confirm publication। ऐसा करने तक बदलाव निजी रहते हैं।",
      },
    },
    {
      q: { en: "The QR code doesn't open my menu.", hi: "QR कोड से मेन्यू नहीं खुलता।" },
      a: {
        en: "Check that Public menu status says Live. Make sure the card is flat, clean and well lit.",
        hi: "Public menu status में Live है या नहीं देखिए। कार्ड सीधा, साफ़ और अच्छी रोशनी में होना चाहिए।",
      },
    },
    {
      q: { en: "New orders don't appear.", hi: "नए ऑर्डर नहीं दिख रहे।" },
      a: {
        en: "Check your internet and click Sync. The top bar should say Live.",
        hi: "इंटरनेट देखिए और Sync पर क्लिक कीजिए। ऊपर की पट्टी में Live लिखा होना चाहिए।",
      },
    },
    {
      q: { en: "There is no sound for new orders.", hi: "नए ऑर्डर की आवाज़ नहीं आती।" },
      a: {
        en: "Turn on the Chime (Orders) or Sound (Kitchen) button, and check the device volume.",
        hi: "Chime (Orders) या Sound (Kitchen) बटन चालू कीजिए और डिवाइस की आवाज़ देखिए।",
      },
    },
    {
      q: {
        en: "The photo import read my menu badly.",
        hi: "फ़ोटो इम्पोर्ट में मेन्यू ठीक से नहीं पढ़ा गया।",
      },
      a: {
        en: "Take clearer photos in good light, one page at a time. Fix anything wrong in the review step.",
        hi: "अच्छी रोशनी में साफ़ फ़ोटो लीजिए, एक बार में एक पेज। रिव्यू स्टेप में गलत चीज़ें ठीक कर लीजिए।",
      },
    },
    {
      q: { en: "My reports show zero.", hi: "मेरी रिपोर्ट में सब ज़ीरो है।" },
      a: {
        en: "Choose a wider period such as Last 30 Days.",
        hi: "बड़ी अवधि चुनिए, जैसे Last 30 Days।",
      },
    },
    {
      q: { en: "A page is missing for my staff.", hi: "मेरे स्टाफ़ को कोई पेज नहीं दिख रहा।" },
      a: {
        en: "Pages depend on the role. Check it in Organization & access.",
        hi: "पेज रोल पर निर्भर करते हैं। Organization & access में रोल देखिए।",
      },
    },
    {
      q: { en: "The page looks stuck.", hi: "पेज अटका हुआ लग रहा है।" },
      a: {
        en: "Refresh the page and check your internet. Still stuck? Send us a screenshot on WhatsApp.",
        hi: "पेज रिफ़्रेश कीजिए और इंटरनेट देखिए। फिर भी अटका है? हमें WhatsApp पर स्क्रीनशॉट भेजिए।",
      },
    },
  ],
  glossaryTitle: { en: "Words you will see", hi: "ये शब्द आपको दिखेंगे" } as Bi,
  glossary: [
    {
      term: { en: "Dashboard", hi: "डैशबोर्ड" },
      text: {
        en: "Your home screen after you sign in.",
        hi: "साइन इन के बाद का आपका होम स्क्रीन।",
      },
    },
    {
      term: { en: "Outlet", hi: "आउटलेट" },
      text: {
        en: "One restaurant or shop location.",
        hi: "आपका एक रेस्टोरेंट या दुकान की एक जगह।",
      },
    },
    {
      term: { en: "Organization", hi: "ऑर्गनाइज़ेशन" },
      text: {
        en: "Your whole business, with all its outlets and people.",
        hi: "आपका पूरा बिज़नेस, उसके सभी आउटलेट और लोगों के साथ।",
      },
    },
    {
      term: { en: "Menu Studio", hi: "मेन्यू स्टूडियो" },
      text: { en: "Where you add and change dishes.", hi: "जहाँ आप डिश जोड़ते और बदलते हैं।" },
    },
    {
      term: { en: "Section", hi: "सेक्शन" },
      text: {
        en: "A group of dishes, such as Starters or Breads.",
        hi: "डिश का एक ग्रुप, जैसे Starters या Breads।",
      },
    },
    {
      term: { en: "Draft", hi: "ड्राफ़्ट" },
      text: {
        en: "Your private copy. Guests cannot see it.",
        hi: "आपकी निजी कॉपी। ग्राहक इसे नहीं देख सकते।",
      },
    },
    {
      term: { en: "Publish", hi: "पब्लिश" },
      text: { en: "Make your changes live for guests.", hi: "बदलाव ग्राहकों के लिए चालू करना।" },
    },
    {
      term: { en: "QR code", hi: "QR कोड" },
      text: {
        en: "A square picture guests scan to open your menu.",
        hi: "चौकोर तस्वीर जिसे स्कैन करके ग्राहक आपका मेन्यू खोलते हैं।",
      },
    },
    {
      term: { en: "Print Studio", hi: "प्रिंट स्टूडियो" },
      text: {
        en: "Where you design printed QR cards.",
        hi: "जहाँ आप छपे हुए QR कार्ड डिज़ाइन करते हैं।",
      },
    },
    {
      term: { en: "Ticket", hi: "टिकट" },
      text: {
        en: "One order shown on the Orders or Kitchen screen.",
        hi: "Orders या Kitchen स्क्रीन पर दिखने वाला एक ऑर्डर।",
      },
    },
    {
      term: { en: "Station", hi: "स्टेशन" },
      text: {
        en: "A cooking area in your kitchen, like Grill or Tandoor.",
        hi: "आपके किचन में खाना बनाने की जगह, जैसे Grill या Tandoor।",
      },
    },
    {
      term: { en: "Sold out", hi: "सोल्ड आउट" },
      text: {
        en: "A dish that has finished. Guests cannot order it.",
        hi: "ऐसी डिश जो ख़त्म हो गई है। ग्राहक उसे ऑर्डर नहीं कर सकते।",
      },
    },
  ] as { term: Bi; text: Bi }[],
  contact: {
    title: { en: "We are here to help", hi: "हम आपकी मदद के लिए हैं" } as Bi,
    intro: {
      en: "Write to us any time. The more you tell us, the faster we can help.",
      hi: "कभी भी हमें लिखिए। आप जितना बताएँगे, हम उतनी जल्दी मदद कर पाएँगे।",
    } as Bi,
    tellUs: { en: "Please tell us", hi: "कृपया हमें बताइए" } as Bi,
    items: [
      { en: "Your restaurant name", hi: "आपके रेस्टोरेंट का नाम" },
      { en: "What you were trying to do", hi: "आप क्या करने की कोशिश कर रहे थे" },
      {
        en: "What you saw on the screen (a screenshot helps a lot)",
        hi: "स्क्रीन पर क्या दिखा (स्क्रीनशॉट से बहुत मदद मिलती है)",
      },
      { en: "Whether you use a phone or a computer", hi: "आप फ़ोन इस्तेमाल करते हैं या कंप्यूटर" },
    ] as Bi[],
  },
};

export const BACK_COVER = {
  line: {
    en: "Great food. Smoother service. Happier you.",
    hi: "बढ़िया खाना। आसान सर्विस। ज़्यादा ख़ुशी।",
  } as Bi,
  thanks: { en: "Thank you", hi: "धन्यवाद" } as Bi,
};
