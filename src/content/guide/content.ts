/**
 * Bilingual (English + Hindi) User Operation Guide content. Rendered to PDF by scripts/guide/build-pdf.mjs
 * (and later to the in-app /help guide). Hindi is deliberately everyday spoken Hindi; app words such as
 * Menu, QR, Dashboard and Publish stay in English because that is what people see on screen.
 * Screenshot ids refer to scripts/guide/shots.mjs and public/guide/shots/.
 */
export type Bi = { en: string; hi: string };

export type GuideInstruction = {
  /** Call-out number shown on the screenshot; omit for steps with no marker. */
  mark?: number;
  text: Bi;
};

export type GuideStep = {
  kind: "step";
  no: number;
  title: Bi;
  intro: Bi;
  desktop?: string;
  mobile?: string;
  instructions: GuideInstruction[];
  tip?: Bi;
  warn?: Bi;
  /** Slightly smaller screenshots for tall screens. */
  compact?: boolean;
};

export type GuideChapter = {
  no: number;
  title: Bi;
  tagline: Bi;
  learn: Bi[];
  steps: GuideStep[];
  recap: { checks: Bi[]; faqs: { q: Bi; a: Bi }[] };
};

export const SUPPORT = {
  email: "admin@bababuilds.com",
  whatsapp: "+91 81144 34889",
};

export const CONTACT_LINE: Bi = {
  en: "Need help? Email or WhatsApp us.",
  hi: "मदद चाहिए? हमें ईमेल या WhatsApp कीजिए।",
};

export const CHAPTER_LIST: { no: number; title: Bi }[] = [
  { no: 1, title: { en: "Welcome to MenuMinute", hi: "MenuMinute में आपका स्वागत है" } },
  { no: 2, title: { en: "Sign up and set up your restaurant", hi: "साइन अप और रेस्टोरेंट सेटअप" } },
  { no: 3, title: { en: "Build your menu", hi: "अपना मेन्यू बनाइए" } },
  { no: 4, title: { en: "QR codes for your tables", hi: "टेबल के लिए QR कोड" } },
  { no: 5, title: { en: "What your guests see", hi: "ग्राहक को क्या दिखता है" } },
  { no: 6, title: { en: "Taking orders", hi: "ऑर्डर लेना" } },
  { no: 7, title: { en: "The kitchen board", hi: "किचन बोर्ड" } },
  { no: 8, title: { en: "Tables and dining floor", hi: "टेबल और डाइनिंग फ़्लोर" } },
  { no: 9, title: { en: "Reports", hi: "रिपोर्ट" } },
  { no: 10, title: { en: "Team and settings", hi: "टीम और सेटिंग" } },
  { no: 11, title: { en: "Help and troubleshooting", hi: "मदद और समस्या का हल" } },
];

export const COVER = {
  eyebrow: { en: "USER OPERATION GUIDE", hi: "उपयोग की गाइड" },
  line1: { en: "Your restaurant,", hi: "आपका रेस्टोरेंट," },
  line2: { en: "made simple.", hi: "अब आसान।" },
  sub: {
    en: "A step-by-step guide to set up and run MenuMinute. No technical knowledge needed.",
    hi: "MenuMinute शुरू करने और चलाने की स्टेप-बाय-स्टेप गाइड। इसके लिए कोई टेक्निकल जानकारी नहीं चाहिए।",
  },
  strip: {
    en: "Menu  ·  QR codes  ·  Orders  ·  Kitchen  ·  Reports",
    hi: "मेन्यू  ·  QR कोड  ·  ऑर्डर  ·  किचन  ·  रिपोर्ट",
  },
};

export const HOW_TO_READ = {
  title: { en: "How to use this guide", hi: "इस गाइड को कैसे पढ़ें" },
  intro: {
    en: "You do not need to read it all at once. Open the chapter you need and follow the numbered steps.",
    hi: "पूरी गाइड एक साथ पढ़ना ज़रूरी नहीं है। जो चैप्टर चाहिए, वही खोलिए और नंबर वाले स्टेप्स फ़ॉलो कीजिए।",
  },
  cards: [
    {
      tone: "cream",
      title: { en: "Two languages on every page", hi: "हर पेज पर दो भाषाएँ" },
      text: {
        en: "English comes first and Hindi sits right below it. Read whichever feels easier.",
        hi: "पहले English और उसके ठीक नीचे हिंदी। जो आसान लगे, वही पढ़िए।",
      },
    },
    {
      tone: "mint",
      title: { en: "Orange numbers", hi: "नारंगी नंबर" },
      text: {
        en: "The orange circles on a screenshot match the numbers in the steps below it.",
        hi: "स्क्रीनशॉट पर नारंगी गोले, नीचे लिखे स्टेप्स के नंबर से मिलते हैं।",
      },
    },
    {
      tone: "lav",
      title: { en: "Computer and phone", hi: "कंप्यूटर और फ़ोन" },
      text: {
        en: "You will see a computer screen and a phone screen. The steps are the same on both.",
        hi: "आपको कंप्यूटर और फ़ोन, दोनों की स्क्रीन दिखेगी। स्टेप्स दोनों में एक जैसे हैं।",
      },
    },
    {
      tone: "blue",
      title: { en: "Tips and cautions", hi: "सुझाव और सावधानी" },
      text: {
        en: "Green boxes are quick tips. Orange boxes are things to be careful about.",
        hi: "हरे डिब्बे में छोटे सुझाव हैं। नारंगी डिब्बे में सावधानी की बातें हैं।",
      },
    },
  ],
  wordsTitle: { en: "Words you will see", hi: "ये शब्द आपको दिखेंगे" },
  words: [
    {
      term: { en: "Dashboard", hi: "डैशबोर्ड" },
      text: {
        en: "Your home screen after you log in.",
        hi: "लॉग इन करने के बाद दिखने वाला आपका होम स्क्रीन।",
      },
    },
    {
      term: { en: "Draft", hi: "ड्राफ़्ट" },
      text: {
        en: "Your private copy of the menu. Guests cannot see it.",
        hi: "मेन्यू की आपकी निजी कॉपी। ग्राहक इसे नहीं देख सकते।",
      },
    },
    {
      term: { en: "Publish", hi: "पब्लिश" },
      text: {
        en: "Make your changes live for guests.",
        hi: "अपने बदलाव ग्राहकों के लिए चालू करना।",
      },
    },
    {
      term: { en: "QR code", hi: "QR कोड" },
      text: {
        en: "A square picture. Guests scan it with their phone camera to open your menu.",
        hi: "एक चौकोर तस्वीर। ग्राहक फ़ोन के कैमरे से स्कैन करके आपका मेन्यू खोलते हैं।",
      },
    },
  ],
  roles: {
    title: { en: "Who does what", hi: "किसका क्या काम" },
    items: [
      {
        role: { en: "Owner / Manager", hi: "मालिक / मैनेजर" },
        text: {
          en: "Sets up the restaurant, menu, QR codes, team and reports.",
          hi: "रेस्टोरेंट, मेन्यू, QR कोड, टीम और रिपोर्ट सेट करते हैं।",
        },
      },
      {
        role: { en: "Counter / Waiter", hi: "काउंटर / वेटर" },
        text: {
          en: "Takes and tracks orders and looks after tables.",
          hi: "ऑर्डर लेते हैं, उन्हें ट्रैक करते हैं और टेबल संभालते हैं।",
        },
      },
      {
        role: { en: "Kitchen", hi: "किचन" },
        text: {
          en: "Sees new orders and marks them ready.",
          hi: "नए ऑर्डर देखते हैं और तैयार होने पर मार्क करते हैं।",
        },
      },
    ],
  },
};

export const ROADMAP = {
  title: { en: "Your first day in five steps", hi: "पहले दिन के पाँच स्टेप" },
  intro: {
    en: "Follow these in order and your guests can scan and order on the same day.",
    hi: "इन्हें क्रम से कीजिए, और उसी दिन आपके ग्राहक स्कैन करके ऑर्डर कर सकते हैं।",
  },
  steps: [
    {
      ch: 2,
      text: {
        en: "Sign up and add your restaurant details",
        hi: "साइन अप कीजिए और रेस्टोरेंट की जानकारी भरिए",
      },
    },
    {
      ch: 3,
      text: {
        en: "Add your dishes and publish the menu",
        hi: "अपनी डिश जोड़िए और मेन्यू पब्लिश कीजिए",
      },
    },
    {
      ch: 4,
      text: {
        en: "Print QR codes and place them on tables",
        hi: "QR कोड प्रिंट कीजिए और टेबल पर रखिए",
      },
    },
    { ch: 6, text: { en: "Accept your first order", hi: "अपना पहला ऑर्डर स्वीकार कीजिए" } },
    { ch: 7, text: { en: "Mark it ready in the kitchen", hi: "किचन में उसे Ready मार्क कीजिए" } },
  ],
};

export const CHAPTER_3: GuideChapter = {
  no: 3,
  title: { en: "Build your menu", hi: "अपना मेन्यू बनाइए" },
  tagline: {
    en: "Add your dishes once. Change them any time.",
    hi: "डिश एक बार जोड़िए। जब चाहें बदलिए।",
  },
  learn: [
    { en: "Find Menu Studio", hi: "Menu Studio कहाँ है, यह जानिए" },
    { en: "See and edit your sections and dishes", hi: "सेक्शन और डिश देखिए और बदलिए" },
    { en: "Add a new dish by hand", hi: "हाथ से नई डिश जोड़िए" },
    {
      en: "Turn a printed menu into a digital one with photos",
      hi: "फ़ोटो से छपे मेन्यू को डिजिटल बनाइए",
    },
    {
      en: "Publish so guests see the latest menu",
      hi: "पब्लिश कीजिए ताकि ग्राहक नया मेन्यू देखें",
    },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "Open Menu Studio", hi: "Menu Studio खोलिए" },
      intro: {
        en: "Menu Studio is where your menu lives. Everything in this chapter happens here.",
        hi: "Menu Studio वह जगह है जहाँ आपका मेन्यू रहता है। इस चैप्टर का सारा काम यहीं होता है।",
      },
      desktop: "menu-nav",
      mobile: "menu-nav",
      instructions: [
        {
          mark: 1,
          text: {
            en: "On a computer, click Menu Studio in the left menu.",
            hi: "कंप्यूटर में, बाईं तरफ़ के मेन्यू में Menu Studio पर क्लिक कीजिए।",
          },
        },
        {
          text: {
            en: "On a phone, tap Menus at the bottom of the screen.",
            hi: "फ़ोन में, स्क्रीन के नीचे Menus पर टैप कीजिए।",
          },
        },
      ],
      tip: {
        en: "Can't find it? Press Ctrl + K on a computer and type “menu”.",
        hi: "नहीं मिल रहा? कंप्यूटर में Ctrl + K दबाइए और “menu” लिखिए।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "See your sections and dishes", hi: "अपने सेक्शन और डिश देखिए" },
      intro: {
        en: "Your menu is split into sections, such as Starters or Breads. Each section holds its dishes.",
        hi: "आपका मेन्यू सेक्शन में बँटा होता है, जैसे Starters या Breads। हर सेक्शन में उसकी डिश होती हैं।",
      },
      desktop: "menu-dishes",
      mobile: "menu-dishes",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Type a name in the search box to find a dish quickly.",
            hi: "कोई डिश जल्दी ढूँढने के लिए Search बॉक्स में उसका नाम लिखिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Click Add dish to add something new.",
            hi: "नई डिश जोड़ने के लिए Add dish पर क्लिक कीजिए।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Click the pencil on a dish to change its name, price or description. The arrows move it up or down.",
            hi: "किसी डिश का नाम, कीमत या डिस्क्रिप्शन बदलने के लिए पेंसिल पर क्लिक कीजिए। तीर वाले बटन से डिश ऊपर-नीचे होती है।",
          },
        },
      ],
      tip: {
        en: "Your changes stay private in a draft until you publish. You can't break anything by trying.",
        hi: "आपके बदलाव तब तक ड्राफ़्ट में निजी रहते हैं जब तक आप पब्लिश नहीं करते। कोशिश करने से कुछ बिगड़ता नहीं।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "Add a dish", hi: "नई डिश जोड़िए" },
      intro: {
        en: "A small panel opens on the right. Fill in the name and price, and you are done.",
        hi: "दाईं तरफ़ एक छोटा पैनल खुलता है। नाम और कीमत भरिए, बस हो गया।",
      },
      desktop: "menu-add-dish",
      mobile: "menu-add-dish",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Type the dish name, for example Paneer Tikka. A description is optional.",
            hi: "डिश का नाम लिखिए, जैसे Paneer Tikka। डिस्क्रिप्शन लिखना ज़रूरी नहीं है।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Enter the price. Then choose the Section it belongs to.",
            hi: "कीमत भरिए। फिर वह Section चुनिए जिसमें डिश आती है।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Click Add to draft. The dish is saved privately.",
            hi: "Add to draft पर क्लिक कीजिए। डिश निजी तौर पर सेव हो जाती है।",
          },
        },
      ],
      warn: {
        en: "Only mark a dish as vegetarian or add allergy details if you are sure. MenuMinute does not check this for you.",
        hi: "डिश को वेज बताइए या एलर्जी की जानकारी तभी जोड़िए जब आपको पक्का पता हो। MenuMinute इसकी जाँच नहीं करता।",
      },
    },
    {
      kind: "step",
      no: 4,
      title: { en: "Import a printed menu from photos", hi: "फ़ोटो से छपा मेन्यू जोड़िए" },
      intro: {
        en: "Already have a printed menu? Take photos of it and MenuMinute makes a draft for you to check.",
        hi: "छपा हुआ मेन्यू पहले से है? उसकी फ़ोटो लीजिए। MenuMinute आपके चेक करने के लिए एक ड्राफ़्ट बना देगा।",
      },
      compact: true,
      desktop: "menu-import",
      mobile: "menu-import",
      instructions: [
        {
          text: {
            en: "On Menu Studio, click Import from photos.",
            hi: "Menu Studio में Import from photos पर क्लिक कीजिए।",
          },
        },
        {
          mark: 1,
          text: {
            en: "Click Use camera to take a photo now.",
            hi: "अभी फ़ोटो लेने के लिए Use camera पर क्लिक कीजिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Or click Choose photos to pick photos from your device. You can add up to 12.",
            hi: "या अपने फ़ोन/कंप्यूटर से फ़ोटो चुनने के लिए Choose photos पर क्लिक कीजिए। ज़्यादा से ज़्यादा 12 फ़ोटो जोड़ सकते हैं।",
          },
        },
        {
          text: {
            en: "Check every dish and price it found, and fix anything wrong. Nothing goes live until you publish.",
            hi: "जो डिश और कीमत मिली, हर एक चेक कीजिए और गलती हो तो ठीक कीजिए। जब तक आप पब्लिश नहीं करते, कुछ भी चालू नहीं होता।",
          },
        },
      ],
      tip: {
        en: "Use clear photos in good light, one page at a time. PDF files cannot be uploaded here.",
        hi: "अच्छी रोशनी में साफ़ फ़ोटो लीजिए, एक बार में एक पेज। यहाँ PDF फ़ाइल अपलोड नहीं हो सकती।",
      },
    },
    {
      kind: "step",
      no: 5,
      title: { en: "Publish your menu", hi: "अपना मेन्यू पब्लिश कीजिए" },
      intro: {
        en: "Publishing makes your latest menu visible to guests. Your QR codes keep working. They never change.",
        hi: "पब्लिश करने पर ग्राहकों को आपका नया मेन्यू दिखने लगता है। आपके QR कोड वही रहते हैं, बदलते नहीं।",
      },
      desktop: "menu-publish",
      mobile: "public-menu",
      instructions: [
        {
          text: {
            en: "Click Preview draft to see how the menu will look.",
            hi: "मेन्यू कैसा दिखेगा, यह देखने के लिए Preview draft पर क्लिक कीजिए।",
          },
        },
        {
          text: {
            en: "Click the dark Publish menu button.",
            hi: "गहरे रंग के Publish menu बटन पर क्लिक कीजिए।",
          },
        },
        {
          mark: 1,
          text: {
            en: "Click Confirm publication. The new menu is now live.",
            hi: "Confirm publication पर क्लिक कीजिए। नया मेन्यू अब चालू है।",
          },
        },
      ],
      tip: {
        en: "The phone picture shows what a guest sees after scanning your QR code.",
        hi: "फ़ोन की तस्वीर में वह दिख रहा है जो ग्राहक को QR कोड स्कैन करने के बाद दिखता है।",
      },
    },
  ],
  recap: {
    checks: [
      { en: "I can find Menu Studio", hi: "मुझे Menu Studio मिल जाता है" },
      { en: "I can edit a dish and its price", hi: "मैं डिश और उसकी कीमत बदल सकता/सकती हूँ" },
      { en: "I can add a new dish", hi: "मैं नई डिश जोड़ सकता/सकती हूँ" },
      {
        en: "I know that photos can make a draft for me",
        hi: "मुझे पता है कि फ़ोटो से ड्राफ़्ट बन सकता है",
      },
      { en: "I can publish my menu", hi: "मैं अपना मेन्यू पब्लिश कर सकता/सकती हूँ" },
    ],
    faqs: [
      {
        q: { en: "My guests can't see the new dish.", hi: "ग्राहकों को नई डिश नहीं दिख रही।" },
        a: {
          en: "Did you publish? Changes stay private until you click Publish menu and then Confirm publication.",
          hi: "क्या आपने पब्लिश किया? बदलाव तब तक निजी रहते हैं जब तक आप Publish menu और फिर Confirm publication पर क्लिक नहीं करते।",
        },
      },
      {
        q: { en: "I entered a wrong price.", hi: "मैंने कीमत गलत भर दी।" },
        a: {
          en: "Click the pencil on the dish, fix the price, then publish again.",
          hi: "डिश की पेंसिल पर क्लिक कीजिए, कीमत ठीक कीजिए, फिर दोबारा पब्लिश कीजिए।",
        },
      },
      {
        q: { en: "The photo import got a dish wrong.", hi: "फ़ोटो इम्पोर्ट में कोई डिश गलत आ गई।" },
        a: {
          en: "That is why you review every dish first. Fix it there, or add the dish by hand.",
          hi: "इसीलिए हर डिश पहले चेक करनी होती है। वहीं ठीक कर लीजिए, या डिश हाथ से जोड़ दीजिए।",
        },
      },
    ],
  },
};
