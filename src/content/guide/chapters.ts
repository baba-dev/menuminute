/**
 * Chapters 1, 2 and 4–10 of the bilingual User Operation Guide (chapter 3 lives in content.ts).
 * Written for non-technical readers: short sentences, everyday spoken Hindi, app words kept in English.
 * Never invent product behaviour: every instruction below was checked against the live demo screens.
 */
import { CHAPTER_3, type GuideChapter } from "./content";

const CH1: GuideChapter = {
  no: 1,
  title: { en: "Welcome to MenuMinute", hi: "MenuMinute में आपका स्वागत है" },
  tagline: {
    en: "Your menu, orders and kitchen. All in one place.",
    hi: "मेन्यू, ऑर्डर और किचन, सब एक ही जगह।",
  },
  learn: [
    { en: "Know what MenuMinute does for you", hi: "जानिए MenuMinute आपके लिए क्या करता है" },
    { en: "Find your way around the left menu", hi: "बाईं तरफ़ के मेन्यू से सही पेज ढूँढिए" },
    {
      en: "Check how your restaurant is doing today",
      hi: "देखिए आज आपका रेस्टोरेंट कैसा चल रहा है",
    },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "Meet your Dashboard", hi: "अपने Dashboard से मिलिए" },
      intro: {
        en: "The Dashboard is the first screen you see after you sign in. It shows your restaurant at a glance.",
        hi: "साइन इन करने के बाद सबसे पहले यही स्क्रीन दिखती है। इसमें आपका रेस्टोरेंट एक नज़र में दिखता है।",
      },
      desktop: "welcome-dashboard",
      mobile: "welcome-dashboard",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Click Open Menu Studio when you want to change your menu.",
            hi: "मेन्यू में बदलाव करना हो तो Open Menu Studio पर क्लिक कीजिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Click Dish Availability to mark a dish as sold out.",
            hi: "कोई डिश ख़त्म हो गई हो तो Dish Availability पर क्लिक करके उसे sold out मार्क कीजिए।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Click Public menu to see the menu exactly as your guests see it.",
            hi: "Public menu पर क्लिक कीजिए। आपका मेन्यू ठीक वैसा दिखेगा जैसा ग्राहक को दिखता है।",
          },
        },
      ],
      tip: {
        en: "Use Customize layout to hide the panels you don't need.",
        hi: "जो पैनल काम के नहीं हैं, उन्हें Customize layout से छुपा सकते हैं।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "Use the left menu", hi: "बाईं तरफ़ का मेन्यू इस्तेमाल कीजिए" },
      intro: {
        en: "Everything you need is in the menu on the left. On a phone, use the bar at the bottom and tap More for the rest.",
        hi: "ज़रूरत की हर चीज़ बाईं तरफ़ के मेन्यू में है। फ़ोन में नीचे की पट्टी इस्तेमाल कीजिए, और बाकी पेज के लिए More पर टैप कीजिए।",
      },
      compact: true,
      desktop: "welcome-nav",
      mobile: "welcome-nav",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Orders: see and accept new orders.",
            hi: "Orders: नए ऑर्डर देखिए और स्वीकार कीजिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Kitchen: the screen your cooks use.",
            hi: "Kitchen: यह स्क्रीन आपके कुक इस्तेमाल करते हैं।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Menu Studio: add and change dishes.",
            hi: "Menu Studio: डिश जोड़िए और बदलिए।",
          },
        },
        {
          mark: 4,
          text: {
            en: "QR codes: get the QR code for your tables.",
            hi: "QR codes: टेबल के लिए QR कोड यहाँ से लीजिए।",
          },
        },
        {
          mark: 5,
          text: {
            en: "Reports & Insights: see how sales are going.",
            hi: "Reports & Insights: देखिए बिक्री कैसी चल रही है।",
          },
        },
      ],
      tip: {
        en: "Each person sees only the pages their role allows. The owner sees everything.",
        hi: "हर व्यक्ति को वही पेज दिखते हैं जिनकी उसके रोल में इजाज़त है। मालिक को सब कुछ दिखता है।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "Check today at a glance", hi: "आज की स्थिति एक नज़र में देखिए" },
      intro: {
        en: "Before you open for the day, look at the At a glance tiles on your Dashboard.",
        hi: "दिन शुरू करने से पहले अपने Dashboard पर At a glance वाले डिब्बे देख लीजिए।",
      },
      desktop: "welcome-glance",
      mobile: "welcome-glance",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Public menu status should say Live. That means guests can see your menu.",
            hi: "Public menu status में Live लिखा होना चाहिए। इसका मतलब है कि ग्राहक आपका मेन्यू देख सकते हैं।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Active QR codes shows how many QR codes are working.",
            hi: "Active QR codes बताता है कि कितने QR कोड चालू हैं।",
          },
        },
      ],
      tip: {
        en: "A new restaurant starts with zeros. The numbers grow as you add dishes and take orders.",
        hi: "नए रेस्टोरेंट में शुरू में सब ज़ीरो दिखता है। डिश जोड़ने और ऑर्डर आने पर नंबर बढ़ते जाते हैं।",
      },
    },
  ],
  recap: {
    checks: [
      { en: "I know what the Dashboard shows", hi: "मुझे पता है Dashboard में क्या दिखता है" },
      {
        en: "I can find Orders, Kitchen and Menu Studio",
        hi: "मुझे Orders, Kitchen और Menu Studio मिल जाते हैं",
      },
      {
        en: "I know Public menu status must say Live",
        hi: "मुझे पता है Public menu status में Live होना चाहिए",
      },
    ],
    faqs: [
      {
        q: { en: "I can't find a page.", hi: "मुझे कोई पेज नहीं मिल रहा।" },
        a: {
          en: "Look in the left menu. On a phone, tap More. Or press Ctrl + K on a computer and type the page name.",
          hi: "बाईं तरफ़ का मेन्यू देखिए। फ़ोन में More पर टैप कीजिए। कंप्यूटर में Ctrl + K दबाकर पेज का नाम लिख दीजिए।",
        },
      },
      {
        q: { en: "A page is missing for my staff.", hi: "मेरे स्टाफ़ को कोई पेज नहीं दिख रहा।" },
        a: {
          en: "Pages depend on the person's role. The owner can change roles in Organization & access (Chapter 10).",
          hi: "पेज व्यक्ति के रोल पर निर्भर करते हैं। मालिक Organization & access में रोल बदल सकते हैं (चैप्टर 10)।",
        },
      },
    ],
  },
};

const CH2: GuideChapter = {
  no: 2,
  title: { en: "Sign up and set up your restaurant", hi: "साइन अप और रेस्टोरेंट सेटअप" },
  tagline: {
    en: "A free account, and you are ready in minutes.",
    hi: "फ़्री अकाउंट बनाइए, और कुछ ही मिनट में तैयार।",
  },
  learn: [
    { en: "Create your free account", hi: "अपना फ़्री अकाउंट बनाइए" },
    { en: "Verify your email and sign in", hi: "ईमेल वेरिफ़ाई कीजिए और साइन इन कीजिए" },
    { en: "Add your restaurant details", hi: "रेस्टोरेंट की जानकारी भरिए" },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "Create your free account", hi: "अपना फ़्री अकाउंट बनाइए" },
      intro: {
        en: "No payment card is needed. You just need your name, an email and a password.",
        hi: "कोई पेमेंट कार्ड नहीं चाहिए। बस आपका नाम, एक ईमेल और पासवर्ड चाहिए।",
      },
      desktop: "signup-register",
      mobile: "signup-register",
      instructions: [
        {
          mark: 1,
          text: { en: "Type your name.", hi: "अपना नाम लिखिए।" },
        },
        {
          mark: 2,
          text: {
            en: "Type your email address. Use one you check every day.",
            hi: "अपना ईमेल लिखिए। ऐसा ईमेल लीजिए जो आप रोज़ देखते हों।",
          },
        },
        {
          text: {
            en: "Choose a password with at least 8 characters, and type it again to confirm.",
            hi: "कम से कम 8 अक्षर का पासवर्ड बनाइए, और पुष्टि के लिए उसे दोबारा लिखिए।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Tick the box to agree to the Terms and Privacy Policy, then click Create free account.",
            hi: "Terms और Privacy Policy से सहमति का बॉक्स टिक कीजिए, फिर Create free account पर क्लिक कीजिए।",
          },
        },
      ],
      tip: {
        en: "Write your password somewhere safe. Do not share it with anyone.",
        hi: "पासवर्ड किसी सुरक्षित जगह लिख लीजिए। इसे किसी को मत बताइए।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "Verify your email and sign in", hi: "ईमेल वेरिफ़ाई कीजिए और साइन इन कीजिए" },
      intro: {
        en: "MenuMinute sends you an email. Open it and click the link inside to confirm it is really you.",
        hi: "MenuMinute आपको एक ईमेल भेजता है। उसे खोलिए और अंदर दिए लिंक पर क्लिक करके पक्का कीजिए कि यह आप ही हैं।",
      },
      desktop: "signup-login",
      mobile: "signup-login",
      instructions: [
        {
          text: {
            en: "Open the email and click the verification link.",
            hi: "ईमेल खोलिए और वेरिफ़िकेशन लिंक पर क्लिक कीजिए।",
          },
        },
        {
          text: {
            en: "Type your email and password on the sign-in page.",
            hi: "साइन इन पेज पर अपना ईमेल और पासवर्ड लिखिए।",
          },
        },
        {
          mark: 1,
          text: { en: "Click Sign in.", hi: "Sign in पर क्लिक कीजिए।" },
        },
        {
          mark: 2,
          text: {
            en: "Forgot your password? Click Forgot your password? and follow the email.",
            hi: "पासवर्ड भूल गए? Forgot your password? पर क्लिक कीजिए और ईमेल में दिए स्टेप्स फ़ॉलो कीजिए।",
          },
        },
      ],
      tip: {
        en: "Can't find the email? Look in your Spam or Promotions folder.",
        hi: "ईमेल नहीं मिल रहा? अपने Spam या Promotions फ़ोल्डर में देखिए।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "Add your restaurant details", hi: "रेस्टोरेंट की जानकारी भरिए" },
      intro: {
        en: "Open Settings in the left menu. Fill each section from top to bottom. Guests see some of these details.",
        hi: "बाईं तरफ़ के मेन्यू में Settings खोलिए। हर सेक्शन ऊपर से नीचे भरिए। इनमें से कुछ जानकारी ग्राहक को दिखती है।",
      },
      compact: true,
      desktop: "setup-profile",
      mobile: "setup-profile",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Outlet essentials: your restaurant name, country, currency and time zone.",
            hi: "Outlet essentials: रेस्टोरेंट का नाम, देश, करेंसी और टाइम ज़ोन।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Restaurant profile: what guests read about you.",
            hi: "Restaurant profile: आपके बारे में ग्राहक जो पढ़ते हैं।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Contact & location: your phone, address and directions.",
            hi: "Contact & location: आपका फ़ोन, पता और रास्ता।",
          },
        },
        {
          mark: 4,
          text: {
            en: "Brand appearance: how your menu looks, such as your logo.",
            hi: "Brand appearance: आपका मेन्यू कैसा दिखे, जैसे आपका लोगो।",
          },
        },
        {
          text: {
            en: "Click Save after you finish each section.",
            hi: "हर सेक्शन भरने के बाद Save पर क्लिक कीजिए।",
          },
        },
      ],
      warn: {
        en: "Check the currency (for example INR) before you add prices. Changing it later may need menu prices to be set again.",
        hi: "कीमतें डालने से पहले करेंसी (जैसे INR) देख लीजिए। बाद में बदलने पर मेन्यू की कीमतें दोबारा डालनी पड़ सकती हैं।",
      },
    },
  ],
  recap: {
    checks: [
      { en: "I created my account", hi: "मैंने अपना अकाउंट बना लिया" },
      { en: "I verified my email and signed in", hi: "मैंने ईमेल वेरिफ़ाई किया और साइन इन किया" },
      { en: "I filled in my restaurant details", hi: "मैंने रेस्टोरेंट की जानकारी भर दी" },
    ],
    faqs: [
      {
        q: { en: "The verification email didn't arrive.", hi: "वेरिफ़िकेशन ईमेल नहीं आया।" },
        a: {
          en: "Wait a minute and check Spam and Promotions. Make sure the email address was typed correctly. Still missing? WhatsApp us.",
          hi: "एक मिनट रुकिए और Spam व Promotions देखिए। ईमेल ठीक लिखा है या नहीं, यह भी देखिए। फिर भी नहीं आया? हमें WhatsApp कीजिए।",
        },
      },
      {
        q: { en: "I forgot my password.", hi: "मैं पासवर्ड भूल गया/गई हूँ।" },
        a: {
          en: "On the sign-in page click Forgot your password? and follow the email.",
          hi: "साइन इन पेज पर Forgot your password? पर क्लिक कीजिए और ईमेल में दिए स्टेप्स फ़ॉलो कीजिए।",
        },
      },
      {
        q: { en: "I have more than one restaurant.", hi: "मेरे एक से ज़्यादा रेस्टोरेंट हैं।" },
        a: {
          en: "Open Organization & access and click Create outlet to add another one.",
          hi: "Organization & access खोलिए और दूसरा रेस्टोरेंट जोड़ने के लिए Create outlet पर क्लिक कीजिए।",
        },
      },
    ],
  },
};

const CH4: GuideChapter = {
  no: 4,
  title: { en: "QR codes for your tables", hi: "टेबल के लिए QR कोड" },
  tagline: {
    en: "Print once. Keep serving.",
    hi: "एक बार प्रिंट कीजिए। हमेशा चलाइए।",
  },
  learn: [
    { en: "Find your QR code", hi: "अपना QR कोड ढूँढिए" },
    { en: "Download or share it", hi: "उसे डाउनलोड या शेयर कीजिए" },
    { en: "Design and print table cards", hi: "टेबल कार्ड डिज़ाइन और प्रिंट कीजिए" },
    { en: "Test it with your own phone", hi: "अपने फ़ोन से जाँच कीजिए" },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "Open QR codes", hi: "QR codes खोलिए" },
      intro: {
        en: "Your QR code never changes. You can change dishes and prices any time, and the same printed code keeps working.",
        hi: "आपका QR कोड कभी नहीं बदलता। डिश और कीमतें जब चाहें बदलिए, वही छपा हुआ कोड चलता रहता है।",
      },
      desktop: "qr-home",
      mobile: "qr-home",
      instructions: [
        {
          text: {
            en: "Click QR codes in the left menu. On a phone, tap QR Codes at the bottom.",
            hi: "बाईं तरफ़ के मेन्यू में QR codes पर क्लिक कीजिए। फ़ोन में नीचे QR Codes पर टैप कीजिए।",
          },
        },
        {
          mark: 1,
          text: {
            en: "Click Create QR if you need a new code.",
            hi: "नया कोड चाहिए तो Create QR पर क्लिक कीजिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Click Open Print Studio to design printed cards.",
            hi: "छपे हुए कार्ड डिज़ाइन करने के लिए Open Print Studio पर क्लिक कीजिए।",
          },
        },
      ],
      tip: {
        en: "Your menu already has a code called Main Menu QR. You can use it right away.",
        hi: "आपके मेन्यू का Main Menu QR नाम का कोड पहले से बना होता है। इसे सीधे इस्तेमाल कर सकते हैं।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "Download or share your QR", hi: "अपना QR डाउनलोड या शेयर कीजिए" },
      intro: {
        en: "Pick your code in the QR library. The buttons under the picture let you save or share it.",
        hi: "QR library में अपना कोड चुनिए। तस्वीर के नीचे के बटन से उसे सेव या शेयर कीजिए।",
      },
      compact: true,
      desktop: "qr-library",
      mobile: "qr-library",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Download PNG: a picture file. Good for WhatsApp and screens.",
            hi: "Download PNG: तस्वीर वाली फ़ाइल। WhatsApp और स्क्रीन के लिए ठीक है।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Download SVG: a sharp file for printers and big banners.",
            hi: "Download SVG: प्रिंटर और बड़े बैनर के लिए साफ़ फ़ाइल।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Copy link: share your menu link online.",
            hi: "Copy link: अपने मेन्यू का लिंक ऑनलाइन शेयर कीजिए।",
          },
        },
        {
          mark: 4,
          text: {
            en: "Design & Print: make nice table cards (next step).",
            hi: "Design & Print: सुंदर टेबल कार्ड बनाइए (अगला स्टेप)।",
          },
        },
      ],
      warn: {
        en: "Revoke QR switches a code off. Regenerate QR makes a new one. Printed cards with the old code may stop working. If you are not sure, ask us first.",
        hi: "Revoke QR कोड को बंद कर देता है। Regenerate QR नया कोड बनाता है। पुराने कोड वाले छपे कार्ड काम करना बंद कर सकते हैं। पक्का न हो तो पहले हमसे पूछ लीजिए।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "Design and print table cards", hi: "टेबल कार्ड डिज़ाइन और प्रिंट कीजिए" },
      intro: {
        en: "Print Studio helps you turn your QR code into something guests like to pick up.",
        hi: "Print Studio आपके QR कोड को ऐसा कार्ड बना देता है जिसे ग्राहक खुशी से उठाकर देखें।",
      },
      desktop: "qr-print",
      mobile: "qr-print",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Click the Print Studio tab at the top of the QR page.",
            hi: "QR पेज पर ऊपर Print Studio टैब पर क्लिक कीजिए।",
          },
        },
        {
          text: {
            en: "Choose a format: Table Stand, Window / Counter Sticker or Menu Insert.",
            hi: "फ़ॉर्मेट चुनिए: Table Stand, Window / Counter Sticker या Menu Insert।",
          },
        },
        {
          text: {
            en: "Pick your table numbers and a look you like, then export the print sheet and print it.",
            hi: "अपने टेबल नंबर और पसंद का डिज़ाइन चुनिए, फिर प्रिंट शीट एक्सपोर्ट करके प्रिंट कीजिए।",
          },
        },
      ],
      tip: {
        en: "Matte lamination keeps the code easy to scan, without shine or glare.",
        hi: "मैट लैमिनेशन करवाइए। इससे चमक नहीं पड़ती और कोड आसानी से स्कैन होता है।",
      },
    },
    {
      kind: "step",
      no: 4,
      title: { en: "Test it before you print a lot", hi: "ज़्यादा प्रिंट करने से पहले जाँच लीजिए" },
      intro: {
        en: "Always scan your own code first. It takes one minute and saves you a lot of trouble.",
        hi: "पहले अपना कोड ख़ुद स्कैन करके देखिए। एक मिनट लगता है और बाद की बहुत परेशानी बच जाती है।",
      },
      mobile: "guest-landing",
      instructions: [
        {
          text: {
            en: "Open the camera on your phone and point it at the code.",
            hi: "अपने फ़ोन का कैमरा खोलिए और कोड की तरफ़ रखिए।",
          },
        },
        {
          text: {
            en: "Tap the link that appears. Your menu should open.",
            hi: "जो लिंक दिखे उस पर टैप कीजिए। आपका मेन्यू खुलना चाहिए।",
          },
        },
        {
          text: {
            en: "Check that your latest dishes and prices are there. Then print more cards.",
            hi: "देखिए कि आपकी नई डिश और कीमतें दिख रही हैं। फिर और कार्ड प्रिंट कीजिए।",
          },
        },
      ],
      tip: {
        en: "Place the card where guests can reach it easily, in good light, flat and clean.",
        hi: "कार्ड ऐसी जगह रखिए जहाँ ग्राहक आसानी से पहुँच सकें, अच्छी रोशनी हो, और वह सीधा व साफ़ हो।",
      },
    },
  ],
  recap: {
    checks: [
      { en: "I found my Main Menu QR", hi: "मुझे अपना Main Menu QR मिल गया" },
      { en: "I downloaded it", hi: "मैंने उसे डाउनलोड कर लिया" },
      { en: "I scanned it with my own phone", hi: "मैंने अपने फ़ोन से उसे स्कैन करके देखा" },
    ],
    faqs: [
      {
        q: {
          en: "Do I need a new QR when my menu changes?",
          hi: "मेन्यू बदलने पर क्या नया QR चाहिए?",
        },
        a: {
          en: "No. The same code opens your latest published menu. Just publish your changes.",
          hi: "नहीं। वही कोड आपका नया पब्लिश किया हुआ मेन्यू खोलता है। बस बदलाव पब्लिश कर दीजिए।",
        },
      },
      {
        q: { en: "The code doesn't open my menu.", hi: "कोड स्कैन करने पर मेन्यू नहीं खुलता।" },
        a: {
          en: "Check that Public menu status says Live on your Dashboard. Make sure the card is flat, clean and in good light.",
          hi: "Dashboard पर Public menu status में Live है या नहीं, देखिए। कार्ड सीधा, साफ़ और अच्छी रोशनी में होना चाहिए।",
        },
      },
      {
        q: { en: "A printed card got damaged.", hi: "छपा हुआ कार्ड ख़राब हो गया।" },
        a: {
          en: "Download the code again from the QR library and print a new card.",
          hi: "QR library से कोड दोबारा डाउनलोड कीजिए और नया कार्ड प्रिंट कर लीजिए।",
        },
      },
    ],
  },
};

const CH5: GuideChapter = {
  no: 5,
  title: { en: "What your guests see", hi: "ग्राहक को क्या दिखता है" },
  tagline: {
    en: "Scan, browse and choose. No app. No account.",
    hi: "स्कैन कीजिए, देखिए और चुनिए। न ऐप, न अकाउंट।",
  },
  learn: [
    { en: "See how a guest opens your menu", hi: "देखिए ग्राहक आपका मेन्यू कैसे खोलता है" },
    { en: "See how guests find a dish", hi: "देखिए ग्राहक डिश कैसे ढूँढते हैं" },
    { en: "See how they add a dish to their order", hi: "देखिए वे डिश ऑर्डर में कैसे जोड़ते हैं" },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "A guest scans your QR", hi: "ग्राहक आपका QR स्कैन करता है" },
      intro: {
        en: "Guests use the camera on their own phone. The menu opens in the browser. They do not need to install an app or make an account.",
        hi: "ग्राहक अपने फ़ोन का कैमरा इस्तेमाल करते हैं। मेन्यू ब्राउज़र में खुल जाता है। कोई ऐप इंस्टॉल करने या अकाउंट बनाने की ज़रूरत नहीं।",
      },
      desktop: "guest-landing",
      mobile: "guest-landing",
      instructions: [
        {
          text: {
            en: "The guest opens the camera and points it at the QR code.",
            hi: "ग्राहक कैमरा खोलकर QR कोड की तरफ़ रखता है।",
          },
        },
        {
          text: {
            en: "Your restaurant page opens with its name, address and a Directions button.",
            hi: "आपके रेस्टोरेंट का पेज खुलता है, जिसमें नाम, पता और Directions बटन होता है।",
          },
        },
        {
          mark: 1,
          text: {
            en: "The guest taps Explore our food to see the dishes.",
            hi: "ग्राहक डिश देखने के लिए Explore our food पर टैप करता है।",
          },
        },
      ],
      tip: {
        en: "The first screen is your shop window. A good logo and description make guests want to look further.",
        hi: "पहली स्क्रीन आपकी दुकान का शोकेस है। अच्छा लोगो और डिस्क्रिप्शन ग्राहक को आगे देखने के लिए खींचता है।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "Guests find a dish", hi: "ग्राहक डिश ढूँढते हैं" },
      intro: {
        en: "Guests can type a name, tap a section, or use a filter to see only what suits them.",
        hi: "ग्राहक नाम लिख सकते हैं, किसी सेक्शन पर टैप कर सकते हैं, या फ़िल्टर लगाकर सिर्फ़ अपनी पसंद की डिश देख सकते हैं।",
      },
      desktop: "guest-filters",
      mobile: "guest-filters",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Search by typing a dish name or a section name.",
            hi: "डिश या सेक्शन का नाम लिखकर ढूँढ सकते हैं।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Filters such as Vegetarian, Vegan, Gluten free, Nut-Free and Dairy-Free narrow the list.",
            hi: "Vegetarian, Vegan, Gluten free, Nut-Free और Dairy-Free जैसे फ़िल्टर से लिस्ट छोटी हो जाती है।",
          },
        },
      ],
      warn: {
        en: "These labels show what you entered in Menu Studio. Only mark a dish if you are sure. Guests trust these labels.",
        hi: "ये लेबल वही दिखाते हैं जो आपने Menu Studio में भरा है। डिश पर लेबल तभी लगाइए जब आपको पक्का पता हो। ग्राहक इन पर भरोसा करते हैं।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "A guest opens a dish and orders", hi: "ग्राहक डिश खोलकर ऑर्डर करता है" },
      intro: {
        en: "Tapping a dish shows its details. The guest chooses how many and adds it to the order.",
        hi: "डिश पर टैप करने से उसकी पूरी जानकारी खुलती है। ग्राहक कितनी चाहिए यह चुनकर उसे ऑर्डर में जोड़ता है।",
      },
      desktop: "guest-dish",
      mobile: "guest-dish",
      instructions: [
        {
          text: {
            en: "The guest reads the description, spice level and flavour notes.",
            hi: "ग्राहक डिस्क्रिप्शन, स्पाइस लेवल और फ़्लेवर नोट्स पढ़ता है।",
          },
        },
        {
          text: {
            en: "The guest uses the minus and plus buttons to choose how many.",
            hi: "ग्राहक माइनस और प्लस बटन से मात्रा चुनता है।",
          },
        },
        {
          mark: 1,
          text: {
            en: "The guest taps Add to Order. The price is shown on the button.",
            hi: "ग्राहक Add to Order पर टैप करता है। कीमत बटन पर ही लिखी होती है।",
          },
        },
      ],
      tip: {
        en: "The order then appears on your Orders screen and in the Kitchen. You will see this in the next chapters.",
        hi: "इसके बाद ऑर्डर आपकी Orders स्क्रीन और Kitchen में दिखता है। यह अगले चैप्टर में देखेंगे।",
      },
    },
  ],
  recap: {
    checks: [
      {
        en: "I know guests need no app or account",
        hi: "मुझे पता है ग्राहक को ऐप या अकाउंट नहीं चाहिए",
      },
      {
        en: "I know how guests find and add a dish",
        hi: "मुझे पता है ग्राहक डिश कैसे ढूँढते और जोड़ते हैं",
      },
      { en: "I keep dish labels correct", hi: "मैं डिश के लेबल सही रखता/रखती हूँ" },
    ],
    faqs: [
      {
        q: {
          en: "A guest orders a dish that is finished.",
          hi: "ग्राहक ऐसी डिश ऑर्डर कर देता है जो ख़त्म है।",
        },
        a: {
          en: "Mark it sold out from Dish Availability on your Dashboard so guests cannot order it.",
          hi: "Dashboard पर Dish Availability से उसे sold out मार्क कर दीजिए, ताकि ग्राहक उसे ऑर्डर न कर सकें।",
        },
      },
      {
        q: { en: "The price on the menu is wrong.", hi: "मेन्यू में कीमत गलत दिख रही है।" },
        a: {
          en: "Fix it in Menu Studio, then publish. The same QR shows the new price.",
          hi: "Menu Studio में ठीक कीजिए और पब्लिश कर दीजिए। वही QR नई कीमत दिखाएगा।",
        },
      },
      {
        q: { en: "A guest says no menu opens.", hi: "ग्राहक कहता है मेन्यू नहीं खुल रहा।" },
        a: {
          en: "Check that Public menu status says Live, and ask the guest to check their internet.",
          hi: "Public menu status में Live है या नहीं देखिए, और ग्राहक से इंटरनेट चेक करने को कहिए।",
        },
      },
    ],
  },
};

const CH6: GuideChapter = {
  no: 6,
  title: { en: "Taking orders", hi: "ऑर्डर लेना" },
  tagline: {
    en: "Every order in one clear place.",
    hi: "हर ऑर्डर एक साफ़ जगह पर।",
  },
  learn: [
    { en: "Open the Orders screen", hi: "Orders स्क्रीन खोलिए" },
    { en: "Accept or decline a new order", hi: "नया ऑर्डर स्वीकार या अस्वीकार कीजिए" },
    { en: "Hand over the food and record payment", hi: "खाना सौंपिए और पेमेंट दर्ज कीजिए" },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "Open Orders", hi: "Orders खोलिए" },
      intro: {
        en: "Orders is your service counter. The tiles at the top count your orders at each stage.",
        hi: "Orders आपका सर्विस काउंटर है। ऊपर के डिब्बे हर स्टेज के ऑर्डर गिनकर दिखाते हैं।",
      },
      desktop: "orders-top",
      mobile: "orders-top",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Needs acceptance: new orders waiting for your answer.",
            hi: "Needs acceptance: नए ऑर्डर जो आपके जवाब का इंतज़ार कर रहे हैं।",
          },
        },
        {
          mark: 2,
          text: {
            en: "In preparation: orders you accepted and the kitchen is making.",
            hi: "In preparation: जो ऑर्डर आपने स्वीकार किए और किचन में बन रहे हैं।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Ready for handoff: food that is ready to serve.",
            hi: "Ready for handoff: खाना जो परोसने के लिए तैयार है।",
          },
        },
      ],
      tip: {
        en: "Click Order history to look at old orders.",
        hi: "पुराने ऑर्डर देखने के लिए Order history पर क्लिक कीजिए।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "Accept a new order", hi: "नया ऑर्डर स्वीकार कीजिए" },
      intro: {
        en: "New orders appear in the Incoming column. Each one is a ticket with the dishes and quantities.",
        hi: "नए ऑर्डर Incoming कॉलम में दिखते हैं। हर ऑर्डर एक टिकट होता है जिसमें डिश और मात्रा लिखी होती है।",
      },
      desktop: "orders-board",
      mobile: "orders-board",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Click Accept if you can make the order.",
            hi: "ऑर्डर बना सकते हैं तो Accept पर क्लिक कीजिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Click Decline if you cannot, for example a dish has finished.",
            hi: "नहीं बना सकते, जैसे कोई डिश ख़त्म हो गई, तो Decline पर क्लिक कीजिए।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Click Details to see the full order and any notes.",
            hi: "पूरा ऑर्डर और नोट्स देखने के लिए Details पर क्लिक कीजिए।",
          },
        },
      ],
      tip: {
        en: "Turn the Chime on at the top of the screen to hear a sound when a new order comes.",
        hi: "स्क्रीन के ऊपर Chime चालू कर दीजिए, ताकि नया ऑर्डर आने पर आवाज़ आए।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "Hand over and record payment", hi: "खाना सौंपिए और पेमेंट दर्ज कीजिए" },
      intro: {
        en: "When the kitchen finishes, the order moves to Ready for handoff. Serve it, then close it here.",
        hi: "किचन का काम पूरा होते ही ऑर्डर Ready for handoff में आ जाता है। उसे परोसिए, फिर यहाँ बंद कीजिए।",
      },
      desktop: "orders-ready",
      mobile: "orders-ready",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Click Mark Collected when the guest has received the food.",
            hi: "ग्राहक को खाना मिल जाने पर Mark Collected पर क्लिक कीजिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Click Record Paid when the guest has paid.",
            hi: "ग्राहक के पैसे देने पर Record Paid पर क्लिक कीजिए।",
          },
        },
      ],
      warn: {
        en: "Check the amount on the ticket before you click Record Paid.",
        hi: "Record Paid पर क्लिक करने से पहले टिकट पर रकम एक बार देख लीजिए।",
      },
    },
  ],
  recap: {
    checks: [
      { en: "I can read the order tiles", hi: "मैं ऑर्डर वाले डिब्बे पढ़ सकता/सकती हूँ" },
      {
        en: "I can accept or decline an order",
        hi: "मैं ऑर्डर स्वीकार या अस्वीकार कर सकता/सकती हूँ",
      },
      {
        en: "I can mark an order collected and paid",
        hi: "मैं ऑर्डर को collected और paid मार्क कर सकता/सकती हूँ",
      },
    ],
    faqs: [
      {
        q: { en: "A new order isn't showing.", hi: "नया ऑर्डर नहीं दिख रहा।" },
        a: {
          en: "Click Sync. Check your internet. The top bar should say Live.",
          hi: "Sync पर क्लिक कीजिए। इंटरनेट देखिए। ऊपर की पट्टी में Live लिखा होना चाहिए।",
        },
      },
      {
        q: { en: "I can't hear new orders.", hi: "नए ऑर्डर की आवाज़ नहीं आती।" },
        a: {
          en: "Turn Chime on, and check the volume of your phone or computer.",
          hi: "Chime चालू कीजिए, और अपने फ़ोन या कंप्यूटर की आवाज़ देखिए।",
        },
      },
      {
        q: { en: "An order is stuck in preparation.", hi: "कोई ऑर्डर In preparation में अटका है।" },
        a: {
          en: "Ask the kitchen to mark each dish complete on the Kitchen screen (Chapter 7).",
          hi: "किचन से कहिए कि Kitchen स्क्रीन पर हर डिश को complete मार्क करें (चैप्टर 7)।",
        },
      },
    ],
  },
};

const CH7: GuideChapter = {
  no: 7,
  title: { en: "The kitchen board", hi: "किचन बोर्ड" },
  tagline: {
    en: "Every station in sight. Every order on time.",
    hi: "हर स्टेशन नज़र में। हर ऑर्डर समय पर।",
  },
  learn: [
    { en: "Set up your kitchen the first time", hi: "पहली बार किचन सेट कीजिए" },
    { en: "Send new orders to the right station", hi: "नए ऑर्डर सही स्टेशन पर भेजिए" },
    { en: "Start and finish each dish", hi: "हर डिश शुरू और पूरी कीजिए" },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "Set up your kitchen (first time)", hi: "किचन सेट कीजिए (पहली बार)" },
      intro: {
        en: "The first time you open Kitchen, a short guide asks where dishes are prepared. A station is a working area, like Grill or Tandoor.",
        hi: "Kitchen पहली बार खोलने पर एक छोटी गाइड पूछती है कि डिश कहाँ बनती हैं। स्टेशन यानी काम करने की जगह, जैसे Grill या Tandoor।",
      },
      compact: true,
      desktop: "kitchen-setup",
      mobile: "kitchen-setup",
      instructions: [
        {
          text: {
            en: "Add a station. Type a name such as Main Kitchen, or tap a ready-made name like Grill or Tandoor.",
            hi: "एक स्टेशन जोड़िए। Main Kitchen जैसा नाम लिखिए, या Grill, Tandoor जैसे बने-बनाए नाम पर टैप कीजिए।",
          },
        },
        {
          text: {
            en: "The guide then asks about Your team, Dish routing and a Ready check. Dish routing decides which dishes go to which station.",
            hi: "इसके बाद गाइड Your team, Dish routing और Ready check के बारे में पूछती है। Dish routing तय करती है कि कौन-सी डिश किस स्टेशन पर जाएगी।",
          },
        },
        {
          mark: 1,
          text: {
            en: "Click Continue after each step until the guide is done.",
            hi: "गाइड पूरी होने तक हर स्टेप के बाद Continue पर क्लिक कीजिए।",
          },
        },
      ],
      tip: {
        en: "A small restaurant can start with just one station.",
        hi: "छोटा रेस्टोरेंट सिर्फ़ एक स्टेशन से शुरू कर सकता है।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "Send new orders to a station", hi: "नए ऑर्डर स्टेशन पर भेजिए" },
      intro: {
        en: "New orders wait in a box at the top of the Kitchen screen until someone accepts them.",
        hi: "नए ऑर्डर Kitchen स्क्रीन के ऊपर एक डिब्बे में तब तक रुके रहते हैं जब तक कोई उन्हें स्वीकार न करे।",
      },
      desktop: "kitchen-incoming",
      mobile: "kitchen-incoming",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Click Accept & route. The order goes to the right station for each dish.",
            hi: "Accept & route पर क्लिक कीजिए। हर डिश का ऑर्डर उसके सही स्टेशन पर चला जाता है।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Click Decline if the kitchen cannot make it.",
            hi: "किचन नहीं बना सकता तो Decline पर क्लिक कीजिए।",
          },
        },
      ],
      tip: {
        en: "A sound can tell you when a new order arrives. Use the Sound button at the top.",
        hi: "नया ऑर्डर आने पर आवाज़ आ सकती है। इसके लिए ऊपर Sound बटन इस्तेमाल कीजिए।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "Start and finish each dish", hi: "हर डिश शुरू और पूरी कीजिए" },
      intro: {
        en: "The board has three columns: To prepare, Preparing and Completed. Dishes move from left to right.",
        hi: "बोर्ड पर तीन कॉलम हैं: To prepare, Preparing और Completed। डिश बाएँ से दाएँ बढ़ती जाती हैं।",
      },
      desktop: "kitchen-board",
      mobile: "kitchen-board",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Click Start preparing when you begin cooking a dish.",
            hi: "डिश बनाना शुरू करते ही Start preparing पर क्लिक कीजिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Click Complete item when the dish is ready.",
            hi: "डिश तैयार होते ही Complete item पर क्लिक कीजिए।",
          },
        },
        {
          text: {
            en: "Use the station buttons at the top to see only your own station.",
            hi: "सिर्फ़ अपना स्टेशन देखने के लिए ऊपर के स्टेशन बटन इस्तेमाल कीजिए।",
          },
        },
      ],
      tip: {
        en: "Use Screen stays on and Fullscreen when a tablet is fixed on your kitchen wall.",
        hi: "किचन की दीवार पर टैबलेट लगा हो तो Screen stays on और Fullscreen इस्तेमाल कीजिए।",
      },
    },
  ],
  recap: {
    checks: [
      { en: "I finished the kitchen setup", hi: "मैंने किचन सेटअप पूरा कर लिया" },
      {
        en: "I can accept and route an order",
        hi: "मैं ऑर्डर स्वीकार करके स्टेशन पर भेज सकता/सकती हूँ",
      },
      { en: "I can start and complete a dish", hi: "मैं डिश शुरू और पूरी कर सकता/सकती हूँ" },
    ],
    faqs: [
      {
        q: { en: "The kitchen screen goes dark.", hi: "किचन की स्क्रीन बंद हो जाती है।" },
        a: {
          en: "Switch on Screen stays on at the top of the Kitchen screen.",
          hi: "Kitchen स्क्रीन के ऊपर Screen stays on चालू कर दीजिए।",
        },
      },
      {
        q: { en: "I see the word Overdue.", hi: "मुझे Overdue लिखा दिख रहा है।" },
        a: {
          en: "It means orders have waited longer than they should. Start preparing them first.",
          hi: "इसका मतलब है कि ऑर्डर ज़रूरत से ज़्यादा देर से रुके हैं। पहले उन्हें शुरू कीजिए।",
        },
      },
      {
        q: { en: "A dish goes to the wrong station.", hi: "कोई डिश गलत स्टेशन पर जा रही है।" },
        a: {
          en: "Check Dish routing in Configure kitchen. You can also use Transfer ticket to move it.",
          hi: "Configure kitchen में Dish routing देखिए। टिकट दूसरे स्टेशन पर भेजने के लिए Transfer ticket भी इस्तेमाल कर सकते हैं।",
        },
      },
    ],
  },
};

const CH8: GuideChapter = {
  no: 8,
  title: { en: "Tables and dining floor", hi: "टेबल और डाइनिंग फ़्लोर" },
  tagline: {
    en: "Know every table at a glance.",
    hi: "हर टेबल एक नज़र में।",
  },
  learn: [
    { en: "Add tables and chairs", hi: "टेबल और कुर्सियाँ जोड़िए" },
    { en: "See your tables by area", hi: "इलाक़े के हिसाब से टेबल देखिए" },
    { en: "Seat a group of guests", hi: "ग्राहकों के ग्रुप को बैठाइए" },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "Open the dining floor", hi: "Dining floor खोलिए" },
      intro: {
        en: "Dining floor is a map of your restaurant. The top of the page shows how many seats you have and how many are taken.",
        hi: "Dining floor आपके रेस्टोरेंट का नक्शा है। पेज के ऊपर दिखता है कि कितनी सीटें हैं और कितनी भरी हैं।",
      },
      desktop: "floor-home",
      mobile: "floor-home",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Click Add table to add a table.",
            hi: "टेबल जोड़ने के लिए Add table पर क्लिक कीजिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Click Add chair to add seats to a table.",
            hi: "टेबल में सीटें जोड़ने के लिए Add chair पर क्लिक कीजिए।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Click Reserve to hold a table for a booking.",
            hi: "बुकिंग के लिए टेबल रोकने के लिए Reserve पर क्लिक कीजिए।",
          },
        },
      ],
      tip: {
        en: "Your plan sets how many tables and chairs you can add. The counters at the top show how many are used.",
        hi: "आपके प्लान से तय होता है कि कितनी टेबल और कुर्सियाँ जोड़ सकते हैं। ऊपर के काउंटर बताते हैं कि कितनी इस्तेमाल हो चुकी हैं।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "See your tables by area", hi: "इलाक़े के हिसाब से टेबल देखिए" },
      intro: {
        en: "Tables are grouped into areas such as Main Dining or Window Room. Tap an area to see only its tables.",
        hi: "टेबल इलाक़ों में बँटी होती हैं, जैसे Main Dining या Window Room। किसी इलाक़े पर टैप करके सिर्फ़ उसकी टेबल देखिए।",
      },
      desktop: "floor-tables",
      mobile: "floor-tables",
      instructions: [
        {
          mark: 1,
          text: { en: "All tables shows every table.", hi: "All tables सारी टेबल दिखाता है।" },
        },
        {
          mark: 2,
          text: {
            en: "Tap an area, such as Main Dining, to filter.",
            hi: "फ़िल्टर करने के लिए Main Dining जैसे किसी इलाक़े पर टैप कीजिए।",
          },
        },
        {
          mark: 3,
          text: {
            en: "The three dots on a table open more actions for that table.",
            hi: "टेबल पर तीन बिंदु उस टेबल के लिए और विकल्प खोलते हैं।",
          },
        },
      ],
      tip: {
        en: "Free, taken and reserved tables look different, so you can see them quickly.",
        hi: "ख़ाली, भरी और रिज़र्व टेबल अलग-अलग दिखती हैं, इसलिए एक नज़र में समझ आ जाती हैं।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "Seat your guests", hi: "ग्राहकों को बैठाइए" },
      intro: {
        en: "When a group arrives, give them a free table and mark it taken.",
        hi: "ग्राहकों का ग्रुप आए तो उन्हें ख़ाली टेबल दीजिए और उसे भरी हुई मार्क कीजिए।",
      },
      desktop: "floor-seat",
      mobile: "floor-seat",
      instructions: [
        {
          text: {
            en: "Find a table that says Free and has enough seats.",
            hi: "ऐसी टेबल ढूँढिए जिस पर Free लिखा हो और जिसमें काफ़ी सीटें हों।",
          },
        },
        {
          mark: 1,
          text: {
            en: "Click Seat party on that table and fill in the details.",
            hi: "उस टेबल पर Seat party पर क्लिक कीजिए और जानकारी भरिए।",
          },
        },
      ],
      tip: {
        en: "Tap a chair to mark it taken or free.",
        hi: "कुर्सी पर टैप करके उसे भरी या ख़ाली मार्क कर सकते हैं।",
      },
    },
  ],
  recap: {
    checks: [
      { en: "I can add a table and chairs", hi: "मैं टेबल और कुर्सियाँ जोड़ सकता/सकती हूँ" },
      { en: "I can see my tables by area", hi: "मैं इलाक़े के हिसाब से टेबल देख सकता/सकती हूँ" },
      { en: "I can seat a party", hi: "मैं ग्राहकों के ग्रुप को बैठा सकता/सकती हूँ" },
    ],
    faqs: [
      {
        q: { en: "I can't add more tables.", hi: "मैं और टेबल नहीं जोड़ पा रहा/रही।" },
        a: {
          en: "Your plan has a limit. Check the Tables and Chairs counters at the top. Ask us about a bigger plan.",
          hi: "आपके प्लान की एक सीमा होती है। ऊपर Tables और Chairs के काउंटर देखिए। बड़े प्लान के बारे में हमसे पूछिए।",
        },
      },
      {
        q: { en: "How do I get QR codes for each table?", hi: "हर टेबल का QR कोड कैसे मिलेगा?" },
        a: {
          en: "Open QR codes, then Print Studio, and choose your table numbers (Chapter 4).",
          hi: "QR codes खोलिए, फिर Print Studio में जाकर अपने टेबल नंबर चुनिए (चैप्टर 4)।",
        },
      },
      {
        q: { en: "I don't see the Dining floor page.", hi: "मुझे Dining floor पेज नहीं दिख रहा।" },
        a: {
          en: "Ask the owner to check your role in Organization & access.",
          hi: "मालिक से कहिए कि Organization & access में आपका रोल देख लें।",
        },
      },
    ],
  },
};

const CH9: GuideChapter = {
  no: 9,
  title: { en: "Reports", hi: "रिपोर्ट" },
  tagline: {
    en: "See how your restaurant is really doing.",
    hi: "देखिए आपका रेस्टोरेंट सच में कैसा चल रहा है।",
  },
  learn: [
    { en: "Pick the days you want to see", hi: "जिन दिनों को देखना है, वे चुनिए" },
    { en: "Read the main numbers", hi: "मुख्य नंबर पढ़िए" },
    {
      en: "Open the daily summary and export a file",
      hi: "डेली समरी खोलिए और फ़ाइल एक्सपोर्ट कीजिए",
    },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "Choose the days", hi: "दिन चुनिए" },
      intro: {
        en: "Open Reports & Insights in the left menu. First choose which days you want to look at.",
        hi: "बाईं तरफ़ के मेन्यू में Reports & Insights खोलिए। पहले चुनिए कि किन दिनों को देखना है।",
      },
      desktop: "reports-dates",
      mobile: "reports-dates",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Today shows today's numbers so far.",
            hi: "Today में आज के अब तक के नंबर दिखते हैं।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Last 7 Days shows the past week.",
            hi: "Last 7 Days में पिछला हफ़्ता दिखता है।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Last 30 Days shows the past month. You can also pick From and To dates, then click Apply dates.",
            hi: "Last 30 Days में पिछला महीना दिखता है। From और To तारीख़ें भी चुन सकते हैं, फिर Apply dates पर क्लिक कीजिए।",
          },
        },
      ],
      tip: {
        en: "Yesterday and This Month are there too.",
        hi: "Yesterday और This Month भी उपलब्ध हैं।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "Read the main numbers", hi: "मुख्य नंबर पढ़िए" },
      intro: {
        en: "The boxes at the top give the headline numbers. The charts below show where they come from.",
        hi: "ऊपर के डिब्बे मुख्य नंबर बताते हैं। नीचे के चार्ट दिखाते हैं कि ये नंबर कहाँ से आए।",
      },
      desktop: "reports-charts",
      mobile: "reports-charts",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Recorded order value: the total value of your orders.",
            hi: "Recorded order value: आपके ऑर्डर की कुल रकम।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Total orders: how many orders came in.",
            hi: "Total orders: कितने ऑर्डर आए।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Average order value: how much a typical order is worth.",
            hi: "Average order value: एक आम ऑर्डर की औसत रकम।",
          },
        },
      ],
      tip: {
        en: "The tabs show more: Menu Intelligence, Point of Sale & Shifts, and Kitchen Velocity. Use Menu Intelligence to find your best-selling dishes.",
        hi: "टैब में और जानकारी है: Menu Intelligence, Point of Sale & Shifts और Kitchen Velocity। सबसे ज़्यादा बिकने वाली डिश जानने के लिए Menu Intelligence देखिए।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "Daily summary and export", hi: "डेली समरी और एक्सपोर्ट" },
      intro: {
        en: "Use these two buttons at the top of the Reports page to review a day or keep a copy.",
        hi: "किसी दिन को देखने या उसकी कॉपी रखने के लिए Reports पेज के ऊपर के इन दो बटन का इस्तेमाल कीजिए।",
      },
      desktop: "reports-export",
      mobile: "reports-export",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Click View Daily Order Summary to see one day in a simple list.",
            hi: "एक दिन को सरल लिस्ट में देखने के लिए View Daily Order Summary पर क्लिक कीजिए।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Click Export CSV to download the data. You can open it in Excel or Google Sheets.",
            hi: "डेटा डाउनलोड करने के लिए Export CSV पर क्लिक कीजिए। उसे Excel या Google Sheets में खोल सकते हैं।",
          },
        },
      ],
      tip: {
        en: "Dishes that sell slowly may need a better photo, a clearer description or a different price.",
        hi: "जो डिश कम बिकती हैं, उनके लिए बेहतर फ़ोटो, साफ़ डिस्क्रिप्शन या अलग कीमत आज़माइए।",
      },
    },
  ],
  recap: {
    checks: [
      { en: "I can choose the days to look at", hi: "मैं देखने के लिए दिन चुन सकता/सकती हूँ" },
      { en: "I understand the main numbers", hi: "मुझे मुख्य नंबर समझ आते हैं" },
      { en: "I can export a report", hi: "मैं रिपोर्ट एक्सपोर्ट कर सकता/सकती हूँ" },
    ],
    faqs: [
      {
        q: { en: "All the numbers are zero.", hi: "सारे नंबर ज़ीरो हैं।" },
        a: {
          en: "Pick a wider period, such as Last 30 Days. A new restaurant also needs some orders first.",
          hi: "बड़ी अवधि चुनिए, जैसे Last 30 Days। नए रेस्टोरेंट में पहले कुछ ऑर्डर आना भी ज़रूरी है।",
        },
      },
      {
        q: { en: "Where is yesterday?", hi: "कल का हिसाब कहाँ है?" },
        a: {
          en: "Click Yesterday at the top of the page.",
          hi: "पेज के ऊपर Yesterday पर क्लिक कीजिए।",
        },
      },
      {
        q: {
          en: "Can I share a report with my accountant?",
          hi: "क्या मैं रिपोर्ट अपने अकाउंटेंट को भेज सकता/सकती हूँ?",
        },
        a: {
          en: "Yes. Click Export CSV and send the file.",
          hi: "हाँ। Export CSV पर क्लिक कीजिए और फ़ाइल भेज दीजिए।",
        },
      },
    ],
  },
};

const CH10: GuideChapter = {
  no: 10,
  title: { en: "Team and settings", hi: "टीम और सेटिंग" },
  tagline: {
    en: "Great service is teamwork.",
    hi: "बढ़िया सर्विस टीमवर्क से बनती है।",
  },
  learn: [
    { en: "Open Organization & access", hi: "Organization & access खोलिए" },
    { en: "Invite a teammate", hi: "अपने स्टाफ़ को इनवाइट कीजिए" },
    { en: "Choose what each role can do", hi: "तय कीजिए कि हर रोल क्या कर सकता है" },
  ],
  steps: [
    {
      kind: "step",
      no: 1,
      title: { en: "Open Organization & access", hi: "Organization & access खोलिए" },
      intro: {
        en: "This is where the owner manages the account, the restaurants and the people.",
        hi: "यहाँ मालिक अकाउंट, रेस्टोरेंट और स्टाफ़ को संभालते हैं।",
      },
      desktop: "team-home",
      mobile: "team-home",
      instructions: [
        {
          mark: 1,
          text: {
            en: "My account: your own name, email and password.",
            hi: "My account: आपका अपना नाम, ईमेल और पासवर्ड।",
          },
        },
        {
          mark: 2,
          text: {
            en: "Outlet settings: what guests see about this restaurant (Chapter 2).",
            hi: "Outlet settings: इस रेस्टोरेंट के बारे में ग्राहक को क्या दिखे (चैप्टर 2)।",
          },
        },
        {
          mark: 3,
          text: {
            en: "Organization: your restaurants, your team and their permissions.",
            hi: "Organization: आपके रेस्टोरेंट, आपकी टीम और उनकी अनुमतियाँ।",
          },
        },
      ],
      tip: {
        en: "Only the owner can see everything here.",
        hi: "यहाँ सब कुछ सिर्फ़ मालिक को दिखता है।",
      },
    },
    {
      kind: "step",
      no: 2,
      title: { en: "Invite a teammate", hi: "अपने स्टाफ़ को इनवाइट कीजिए" },
      intro: {
        en: "You send an invitation by email. The person gets access only after they sign in with that same email and accept.",
        hi: "आप ईमेल से इनवाइट भेजते हैं। वह व्यक्ति उसी ईमेल से साइन इन करके स्वीकार करे, तभी उसे एक्सेस मिलता है।",
      },
      desktop: "team-invite",
      mobile: "team-invite",
      instructions: [
        {
          mark: 1,
          text: {
            en: "Scroll to Invite a teammate.",
            hi: "नीचे Invite a teammate तक जाइए।",
          },
        },
        {
          text: {
            en: "Type their email in Recipient email and choose their Organization role.",
            hi: "Recipient email में उनका ईमेल लिखिए और उनका Organization role चुनिए।",
          },
        },
        {
          mark: 2,
          text: { en: "Click Send invitation.", hi: "Send invitation पर क्लिक कीजिए।" },
        },
      ],
      warn: {
        en: "Invite only people you trust, and give each person only the role they need.",
        hi: "सिर्फ़ उन्हीं को इनवाइट कीजिए जिन पर आपको भरोसा हो, और हर व्यक्ति को उतना ही रोल दीजिए जितना उसे चाहिए।",
      },
    },
    {
      kind: "step",
      no: 3,
      title: { en: "Choose what each role can do", hi: "तय कीजिए हर रोल क्या कर सकता है" },
      intro: {
        en: "A role decides which pages a person can use, such as Orders, Kitchen or Reports.",
        hi: "रोल तय करता है कि व्यक्ति कौन-से पेज इस्तेमाल कर सकता है, जैसे Orders, Kitchen या Reports।",
      },
      desktop: "team-roles",
      mobile: "team-roles",
      instructions: [
        {
          text: {
            en: "In Outlet roles, choose the Outlet and the Member.",
            hi: "Outlet roles में Outlet और Member चुनिए।",
          },
        },
        {
          text: {
            en: "Choose the roles that person should have.",
            hi: "उस व्यक्ति के लिए रोल चुनिए।",
          },
        },
        {
          mark: 1,
          text: { en: "Click Save outlet roles.", hi: "Save outlet roles पर क्लिक कीजिए।" },
        },
      ],
      tip: {
        en: "When someone leaves, remove their access here so they can no longer sign in to your restaurant.",
        hi: "कोई नौकरी छोड़े तो उसका एक्सेस यहीं से हटा दीजिए, ताकि वह आपके रेस्टोरेंट में साइन इन न कर सके।",
      },
    },
  ],
  recap: {
    checks: [
      { en: "I know where to manage my team", hi: "मुझे पता है टीम कहाँ संभालनी है" },
      { en: "I can invite a teammate", hi: "मैं स्टाफ़ को इनवाइट कर सकता/सकती हूँ" },
      { en: "I can change a role", hi: "मैं रोल बदल सकता/सकती हूँ" },
    ],
    faqs: [
      {
        q: { en: "My teammate didn't get the invitation.", hi: "स्टाफ़ को इनवाइट नहीं मिला।" },
        a: {
          en: "Check the email address for typing mistakes and look in Spam. You can see all invitations in Invitation history.",
          hi: "ईमेल में टाइपिंग की गलती देखिए और Spam भी देखिए। सारे इनवाइट Invitation history में दिखते हैं।",
        },
      },
      {
        q: { en: "Someone has left my team.", hi: "कोई मेरी टीम छोड़कर चला गया।" },
        a: {
          en: "Remove their access under People and outlet grants.",
          hi: "People and outlet grants में उनका एक्सेस हटा दीजिए।",
        },
      },
      {
        q: { en: "I want to add another restaurant.", hi: "मुझे दूसरा रेस्टोरेंट जोड़ना है।" },
        a: {
          en: "Click Create outlet on this page.",
          hi: "इसी पेज पर Create outlet पर क्लिक कीजिए।",
        },
      },
    ],
  },
};

/** Chapters 1–10 in order. Chapter 11 (help) is rendered from help.ts. */
export const CHAPTERS: GuideChapter[] = [CH1, CH2, CHAPTER_3, CH4, CH5, CH6, CH7, CH8, CH9, CH10];
