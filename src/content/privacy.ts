/**
 * MenuMinute Privacy Policy — effective 20 October 2026.
 * Keep this disclosure aligned with production data flows and update it
 * before activating additional SDKs, advertising, payments or AI providers.
 */
export const policySections: {
  id: string;
  title: string;
  paragraphs: string[];
  points?: string[];
}[] = [
  {
    id: "scope",
    title: "1. Who we are and what this policy covers",
    paragraphs: [
      "MenuMinute is a restaurant software product operated by BabaBuilds, a sole proprietorship based in Pilani, Rajasthan, India (referred to here as “MenuMinute”, “BabaBuilds”, “we”, “our” or “us”). For privacy questions, contact admin@bababuilds.com. This policy addresses our public website, restaurant dashboards, QR menu experiences, web and progressive web applications, and any future Android or iOS applications where this policy is displayed.",
      "It applies to visitors, restaurant owners and administrators, authorized staff, and guests using participating restaurants’ menus or ordering functions. It also covers our own support and service communications. A restaurant may publish its own privacy notice for uses of diner information that it independently controls.",
      "When we determine the purposes and means of processing our account, security, website, support and platform operational data, BabaBuilds acts as the relevant controller or data fiduciary, as applicable. For restaurant customer information we process to deliver a merchant's requested services, that restaurant generally determines the customer-facing purposes and we may act as its service provider or processor. Actual roles depend on the particular processing and applicable law.",
    ],
  },
  {
    id: "collect",
    title: "2. Information we collect",
    paragraphs: [
      "The information available to us depends on how you use MenuMinute. We collect information you submit, data needed to provide the selected functionality, and limited technical information generated when you connect to our service. You can browse a published QR menu without registering for a MenuMinute account.",
    ],
    points: [
      "Account and team details: name, email, verification status, credentials in protected form, organization membership, role, access permissions, profile settings and account communications.",
      "Restaurant and catalog information: organization and outlet names, business contacts and addresses, logos, menus, menu images, prices, descriptions, QR/table identifiers and other material a merchant chooses to publish.",
      "Guest order information, where ordering is available: order and item details, guest name and optional contact details when requested by the particular order flow, table or pickup context, notes, order status and transaction amount or payment status. An order-tracking token permits a guest to retrieve their order; it is not proof of physical presence.",
      "Uploads and generated content: submitted photographs, menu documents when import becomes available, associated file information, published image derivatives and output reviewed or approved by the merchant.",
      "Technical and security information: session identifiers, IP address, browser or device information, timestamps, authentication events, request/error and audit records, rate-limit signals and usage necessary to operate and protect the service.",
      "Support and preferences: information sent in privacy or support requests, replies, and choices relating to optional communications and non-essential analytics, where those features are enabled.",
      "Future mobile-specific information: camera, photo-library, local notifications, or location data only if a released feature actually requires it and any applicable permissions and notices are provided. This policy is not a statement that all those permissions are currently requested.",
    ],
  },
  {
    id: "purposes",
    title: "3. Why we use information",
    paragraphs: [
      "We use data only for the purposes relevant to the service and authorized features. In particular:",
    ],
    points: [
      "To create and secure accounts, establish organization access, verify identity, maintain sessions and enable account recovery when available.",
      "To publish merchant-approved QR menus, manage outlets, menus and media, and provide restaurant operations.",
      "To accept, route and track orders where available, display them to authorized restaurant staff and maintain necessary transaction history.",
      "To communicate about requested services, important account or security events, customer support and service changes.",
      "To protect accounts and infrastructure, detect misuse, maintain audit trails, investigate incidents, troubleshoot and meet applicable legal obligations.",
      "To measure performance and improve our website or applications. Optional analytics tools such as Google Analytics may be introduced subject to a verified vendor inventory and any legally required consent or choice controls.",
      "To send optional product news or offers only under the applicable permissions and marketing preferences. Service-critical messages are treated separately from promotional messages.",
      "To deliver AI-assisted functionality when enabled for an organization, such as menu extraction, enhancements, translation or media generation. The enabled workflow may process submitted content automatically without an additional click for each item, and relevant data may be transmitted to a disclosed AI service provider.",
    ],
  },
  {
    id: "legal-bases",
    title: "4. Legal bases where applicable",
    paragraphs: [
      "Depending on your location and the activity, we rely on a relevant lawful ground such as performing a contract or taking requested pre-contract steps (accounts, published menus and supported ordering), legitimate interests where permitted (service integrity, security, fraud prevention and proportionate improvement), compliance with legal obligations (required records and responses), or consent (such as optional marketing, non-essential tracking, or a particular sensitive/device use where required). We consider and balance affected rights when relying on legitimate interests.",
      "Under Indian law, including the Digital Personal Data Protection framework as applicable on its phased commencement dates, we provide notices, seek consent and support rights where required, and use other grounds only where law permits. Withdrawing consent does not undo processing already lawful or prevent retention required by law. If a purpose requires consent and it is withdrawn, we will stop that consent-dependent processing subject to lawful exceptions.",
    ],
  },
  {
    id: "sharing",
    title: "5. Who receives information",
    paragraphs: [
      "We do not sell personal information. We share only what is appropriate to the specific purpose, such as with authorized members of your restaurant organization; the restaurant receiving an order; infrastructure and content-delivery, hosting, database, communications, support, security or analytics providers; and, once activated, relevant AI and payment-related providers.",
      "Our infrastructure includes an Oracle-hosted VPS and Cloudflare services. Other providers, including email, analytics, AI and payment services, receive relevant data only when their integrations are enabled for the applicable purpose. We assess relevant provider arrangements and update these disclosures when material processing changes; naming a category here does not mean that every possible integration is currently active.",
      "We may disclose information where required by lawful process, to protect rights or safety, or in connection with a legitimate reorganization or transfer subject to applicable safeguards and notice. We do not give one restaurant unrestricted access to another restaurant's private records. Publicly published menu and restaurant content is visible to anyone with access to its public link.",
    ],
  },
  {
    id: "ai",
    title: "6. AI-assisted features and uploads",
    paragraphs: [
      "If a restaurant enables an AI workflow, relevant menu images, documents, item text, instructions or other inputs may be automatically processed to deliver the enabled task and may be transferred to the selected provider. We aim to minimize unnecessary personal information in those requests. Restaurant operators should not upload unnecessary customer personal information or confidential documents.",
      "AI output may be inaccurate; restaurant staff should review prices, allergens, ingredients and other customer-facing facts before publication. A selected provider's own retention, model-training and international-transfer practices may apply; we do not promise that every provider will refrain from retaining or using submitted material for model improvement. Ask us at the privacy contact for information about the provider relevant to an enabled workflow. Uploaded content may be stored and processed to supply the requested service, and merchant-approved derivatives may be made public in the menu.",
    ],
  },
  {
    id: "cookies",
    title: "7. Cookies, analytics and similar technologies",
    paragraphs: [
      "Our site uses necessary session and preference mechanisms for sign-in, authentication, theme choices, abuse prevention and service delivery. These mechanisms may store identifiers in cookies or similar browser storage. Browser and device settings may allow you to limit them, but disabling essential storage can affect sign-in or other functions.",
      "We may use Google Analytics or a comparable analytics service to understand site use if and when enabled. The particular technology and resulting data depend on the active implementation. Where applicable law requires consent for non-essential analytics or advertising technologies, we will provide the necessary choice before enabling them; you may also contact us regarding your preferences.",
      "We do not currently use personal information to operate a personalized advertising program. If this changes, we will update this policy and provide any required notices and choices before the new processing begins.",
    ],
  },
  {
    id: "security",
    title: "8. Security and access",
    paragraphs: [
      "We use proportionate organizational and technical measures intended to protect information, including access controls, session protections, HTTPS and tenant-scoped authorization measures where implemented. Access to operational records is limited by role and legitimate need. We work to prevent personal data, passwords and security tokens from appearing in ordinary application logs. No internet service can guarantee absolute security.",
      "Please protect your credentials and report suspicious access to admin@bababuilds.com. We investigate reported security issues and take measures appropriate to the information and incident involved.",
    ],
  },
  {
    id: "international",
    title: "9. International processing",
    paragraphs: [
      "MenuMinute is designed for users in multiple countries. Information may be accessed, stored or processed in India and other jurisdictions by our infrastructure and approved providers. Protection standards may differ by country. Where required, we will assess the transfer, identify an appropriate legal transfer mechanism or safeguard, and provide further information upon request. Worldwide availability is not a claim that every future feature is approved under every country's local requirements.",
    ],
  },
  {
    id: "retention",
    title: "10. Retention and deletion",
    paragraphs: [
      "We keep information for as long as reasonably needed for its identified purpose, our relationship with you, security, dispute handling and applicable legal obligations, and then delete or anonymize it as appropriate. Relevant criteria include account status, whether a menu or order remains active, legal and tax recordkeeping requirements, incident investigation and backup retention. Published menu material may remain available while a merchant keeps it published; closing an account does not authorize unnecessary indefinite retention.",
      "Account information is generally needed while the account is active; order and transaction records may be retained for applicable accounting, compliance and dispute requirements; uploads and AI inputs are kept as needed to provide the selected feature; and operational and security records are retained as needed to protect and troubleshoot the service. Some data may remain in backups until they are rotated or otherwise securely removed. We handle verified deletion requests subject to lawful exceptions. For the retention criteria applicable to your information, email admin@bababuilds.com.",
    ],
  },
  {
    id: "rights",
    title: "11. Your choices and privacy rights",
    paragraphs: [
      "Depending on applicable law, you may request access to or a copy of information about you, correction or completion, deletion, portability, restriction or objection, withdrawal of consent, or review of relevant automated decisions where such rights apply. You can also opt out of optional promotional messages without losing essential service notifications. We will not require unnecessary information to handle a request, but may verify identity and confirm your authority over organization data.",
      "Contact admin@bababuilds.com with the subject “MenuMinute Privacy Request” and describe the account, data or right concerned. We will acknowledge and handle the request under the timelines required by applicable law, explain lawful exceptions, and provide available complaint or appeal channels. Guests may also contact the restaurant directly about information the restaurant independently controls.",
      "You may initiate an account or information deletion request through /delete-account or by emailing admin@bababuilds.com. This is currently a contact-based request process, not an instant automated deletion button. An organization owner may need to transfer ownership or resolve existing obligations before an organization-wide request can be completed.",
    ],
  },
  {
    id: "children",
    title: "12. Children and age restrictions",
    paragraphs: [
      "Business account holders and administrators must be at least 18 years old. Public QR menus are not designed to target children, and we do not intentionally solicit children's personal information independently. If you believe a child has submitted personal information without an appropriate lawful basis or authorization, contact us so the situation can be reviewed. Age rules and any additional parental-consent obligations in an applicable jurisdiction still apply.",
    ],
  },
  {
    id: "mobile",
    title: "13. Website, PWA and future mobile applications",
    paragraphs: [
      "This notice is designed to cover the website and PWA alongside any future native Android or iOS release. A mobile build must request protected device access only for a real and disclosed feature. Permissions such as camera or photo-library access must be explained in context and requested through the platform mechanism; users should be able to decline optional permissions.",
      "If native Android or iOS applications are released, their specific permissions, integrated SDKs and relevant app-store privacy disclosures will be based on the functions actually included in those builds. This web policy does not mean that any particular native application or mobile feature is presently available.",
    ],
  },
  {
    id: "updates",
    title: "14. Changes to this policy",
    paragraphs: [
      "We may update this policy as functions, vendors or applicable law change. We will update the effective date and provide additional notice or collect new consent where legally required for material changes. We will not silently treat your acceptance of an earlier version as consent to unrelated future advertising or sensitive-data processing.",
    ],
  },
  {
    id: "contact",
    title: "15. Contact and complaints",
    paragraphs: [
      "BabaBuilds (sole proprietorship), Pilani, Rajasthan, India. Email: admin@bababuilds.com. Please include “MenuMinute Privacy” in the subject line. If you are dissatisfied with our handling of a request, let us know so we can review it; you may also use an applicable regulator or supervisory-authority complaint mechanism where available under law.",
    ],
  },
];
