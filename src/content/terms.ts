/**
 * TERMS OF SERVICE — effective 24 October 2026.
 * Keep reviewed copy aligned with /privacy, /delete-account and actual billing UX.
 */
export type TermsSection = {
  id: string;
  title: string;
  paragraphs: string[];
  points?: string[];
};
export const termsSections: TermsSection[] = [
  {
    id: "operator",
    title: "1. Who provides MenuMinute; agreement and scope",
    paragraphs: [
      "MenuMinute is provided by BabaBuilds, a sole proprietorship based in Pilani, Rajasthan, India (“BabaBuilds”, “MenuMinute”, “we”, “us” or “our”). You can contact us at admin@bababuilds.com. These Terms govern our website, merchant dashboard, published QR menu service, any enabled restaurant ordering and kitchen functions, progressive web app, and future native applications (together, the “Service”).",
      "These Terms apply to persons using the Service in their relevant capacity: a merchant or business acting through its authorized representative (“Merchant”), its authorized account holders and staff (“Users”), and diners or visitors using participating restaurants' public pages (“Guests”). A Merchant representative who accepts on behalf of an organization confirms that they are authorized to bind it. If you do not agree, do not register for or use the functions that require acceptance.",
      "Any separately agreed written enterprise contract or expressly identified product-specific terms will control to the extent of a direct conflict for their stated scope. A future update applies only after the notice or renewed acceptance required by these Terms and applicable law.",
    ],
  },
  {
    id: "platform",
    title: "2. Our role and the restaurant's role",
    paragraphs: [
      "MenuMinute supplies software that helps independent Merchants create, host and publish restaurant menus and, where enabled, manage customer orders and kitchen workflow. Unless expressly stated otherwise for a particular feature, BabaBuilds is not the seller, cook, caterer, restaurant, food preparer, food-delivery carrier, or party taking payment for the Guest's food order. A Guest purchases food or restaurant services from the particular Merchant, not from BabaBuilds.",
      "Merchants are responsible for their businesses, their staff, posted information, food quality and safety, availability, pricing, taxes and fees applicable to their sales, service commitments, refunds and customer communications. We are responsible for providing the subscribed software functions with reasonable care, subject to these Terms and applicable law. Nothing in this section removes any statutory responsibility that law imposes directly on us.",
    ],
  },
  {
    id: "eligibility",
    title: "3. Eligibility, authority and lawful operation",
    paragraphs: [
      "An individual opening, owning or administering a Merchant account must be at least 18 years old and have capacity to enter a contract. The organization creator is expected to have authority to provide its business information and manage its staff. Merchants must keep their identity, outlet details and contact information accurate and provide reasonable verification information where legally necessary.",
      "Merchants must obtain and maintain business, food-safety and other registrations, permits, licenses, approvals and notices required for their actual operations in each relevant jurisdiction. In India, that can include food-business obligations administered by the relevant authorities where applicable; a MenuMinute account or public QR menu is not itself a regulatory authorization.",
      "A Guest may view a publicly published QR menu without holding a MenuMinute business account. A Guest placing an order must have legal capacity for the applicable transaction or have an appropriate parent or guardian involved as required by local law.",
    ],
  },
  {
    id: "accounts",
    title: "4. Accounts, access and organization responsibilities",
    paragraphs: [
      "Keep your credentials confidential, maintain accurate account contact information, and use only the access and organization membership assigned to you. Owners and administrators are responsible for authorizing staff access, promptly removing departed Users and using available role restrictions. Do not share sign-in credentials in place of inviting an authorized team member.",
      "You must inform us promptly at admin@bababuilds.com if you suspect unauthorized access, impersonation or security compromise. We may take proportionate measures, including verification, step-up checks, session invalidation or temporarily restricting access, to protect the Service. We may require verified account information for privileged actions when relevant controls are activated.",
      "Organization and outlet records belong to the appropriate Merchant relationship, subject to the privacy rights of individuals and applicable law. A User's access to one Merchant does not grant them rights to another Merchant's private data.",
    ],
  },
  {
    id: "features",
    title: "5. Product features, free access and limits",
    paragraphs: [
      "The Service may include a free digital QR menu and optional capabilities such as ordering, kitchen display, menu import, translation, media processing, integrations and paid business tools. A marketing demonstration or roadmap description is not a guarantee that a planned feature is available on a specific account, device, country or plan. We identify active plan features and relevant limits in the product or checkout at the time you choose them.",
      "Free access is subject to reasonable security, storage, capacity and fair-use limits, disclosed when material. “Free” does not mean unlimited infrastructure or a promise that every feature remains free indefinitely. We will give appropriate notice before a material reduction to the core free QR-menu offering, subject to safety, legal or abuse-related changes.",
      "You must not evade limits through duplicate accounts, excessive automation or technical workarounds. We may apply proportionate rate and storage controls to protect other users and service reliability.",
    ],
  },
  {
    id: "billing",
    title: "6. Platform plans, billing, taxes and renewals",
    paragraphs: [
      "A Merchant's payment for MenuMinute software (if it elects a paid plan once available) is separate from a Guest's payment to a restaurant for food. Exact paid plans, supported payment methods, prices, billing periods, taxes, billing currencies and any refund conditions must be clearly disclosed at the relevant checkout. No subscription charge or renewal obligation arises merely from viewing a roadmap page or using a free QR menu.",
      "Where recurring billing is offered, the checkout must separately disclose whether it auto-renews, the amount and frequency or calculation method, any trial/conversion date, cancellation method and when a cancellation takes effect. We will obtain the appropriate authorization before charging. A future plan change, price change or tax adjustment will be handled with the notice and consent required by applicable law. A subscription cannot be represented as non-refundable where a mandatory refund right applies.",
      "A Merchant is responsible for its own business and outlet sales taxes, invoices, regulatory disclosures, customer charges and accounting. BabaBuilds is responsible for its own platform-billing disclosures and taxes. We will publish a specific refund/cancellation policy once real paid plans and collection arrangements are approved. App-store purchases, if ever offered, are additionally subject to the store's then-applicable billing and refund rules.",
    ],
  },
  {
    id: "merchant-content",
    title: "7. Merchant content, ownership and permission to host",
    paragraphs: [
      "You retain your lawful rights in restaurant names, logos, menus, recipes, descriptions, photographs, uploaded documents and other materials you submit (“Merchant Content”). You confirm you own these materials or have all permissions necessary to upload, reproduce, edit and publish them, including rights to images, trademarks and personal information; you must not submit confidential information or personal data you lack authority to process.",
      "You grant BabaBuilds a limited, non-exclusive, worldwide, royalty-free license for the duration reasonably required to host, store, back up, display, transmit, resize, format, process and publish Merchant Content as you instruct through the Service, and to let authorized providers perform those functions on our behalf. You also permit us to display your public restaurant details and published menus to visitors. This license is for providing, securing and supporting the Service, not a transfer of your ownership or an unrestricted right to sell your content.",
      "You remain responsible for reviewing and correcting public material, including price, currency, operating hours, availability, nutrition, allergen, dietary, tax and consumer information. We may remove or restrict content we reasonably believe is unlawful, infringes rights, threatens users or violates these Terms, subject to legally required notice and remedies. You should keep independent copies of important business records.",
    ],
  },
  {
    id: "qr",
    title: "8. Public menus, QR links and published information",
    paragraphs: [
      "A published QR link can be viewed and shared by anyone who obtains it. Do not treat a scan or knowledge of a QR link as proof of a Guest's identity or physical presence. Merchants decide where QR materials are placed and must verify the destination before printing and distributing them. Avoid placing private data in public-facing menu, QR or service-point descriptions.",
      "Our product design seeks to preserve printed QR identities across ordinary menu edits, renames, plan changes and supported outlet changes. This is not an unconditional perpetual hosting guarantee: Merchant deletion or regeneration, closure, confirmed abuse, legal restriction, or material discontinuation can invalidate a link. We will use reasonable means to inform Merchants of material link-affecting changes when practicable.",
      "Offline or cached pages may be stale and should be labeled as such. Internet connectivity and live confirmation are required before treating an order as submitted; an offline view or a QR scan alone is not an order.",
    ],
  },
  {
    id: "ordering",
    title: "9. Guest ordering, acceptance and fulfillment",
    paragraphs: [
      "Where a Merchant has enabled an ordering feature, the Merchant makes the food or service offer and sets its supported modes, order times, prices and any disclosed conditions. A Guest should review the final displayed details before submission. A technical submission receipt acknowledges that the request reached the system; it does not mean the Merchant has accepted or begun preparing it. The Merchant may accept, decline, cancel or let a pending request expire under the disclosed order workflow and applicable law.",
      "After the Merchant accepts an order, the Merchant remains responsible for preparing, providing and accurately communicating fulfillment. Dine-in and collection/pickup may be supported where enabled; courier delivery, online diner payment, pre-orders or other modes are not implied by a demonstration or a table/room label. Material price or availability changes should be presented to the Guest for review rather than silently charged.",
      "If you have a problem with food, ingredients, preparation, missing items, collection, restaurant payment or a Merchant's refund, contact that Merchant first using its available contact details. You may separately tell us of suspected platform abuse or a software defect. We will reasonably assist with Service-related issues within our role and cooperate where applicable law requires more.",
    ],
  },
  {
    id: "guest-safety",
    title: "10. Food information, allergies and consumer rights",
    paragraphs: [
      "Food descriptions, ingredients, allergens, dietary labels, cooking claims, stock and serving details are supplied and approved by the Merchant. A Guest with allergies or specific dietary, medical or religious restrictions should confirm suitability directly with the Merchant before ordering. The Service does not independently test ingredients, certify kitchens or guarantee that Merchant-supplied information is complete or accurate.",
      "Nothing in these Terms limits a Guest's rights against the Merchant or BabaBuilds under applicable consumer, food-safety, product-liability, privacy or other non-excludable laws. Where law requires a particular disclosure, grievance process, remedy, correction or refund, that requirement prevails over inconsistent wording here.",
    ],
  },
  {
    id: "merchant-obligations",
    title: "11. Merchant staff, customers, records and compliance",
    paragraphs: [
      "Merchants must supervise their employees and contractors, configure access appropriately, and ensure posted menu and sales information is lawful and accurate. They must handle Guest contact and order information only for legitimate, disclosed purposes and meet applicable privacy, consumer-protection, food, invoicing, recordkeeping and communications requirements. A Merchant must not harvest Guest information from QR visits or orders for unrelated marketing without an appropriate lawful basis.",
      "Where the Service acts on a Merchant's instructions to process customer data, the parties may need a separate data-processing agreement or terms before enabling a regulated processing activity. Our Privacy Policy explains processing where BabaBuilds has its own responsibility; it does not substitute for the Merchant's legally required customer notice.",
    ],
  },
  {
    id: "acceptable-use",
    title: "12. Acceptable use and prohibited conduct",
    paragraphs: [
      "You must use the Service lawfully and without unreasonably harming other users or the infrastructure. You may not:",
    ],
    points: [
      "Impersonate another person or business, misuse accounts or access data beyond an assigned tenant, outlet or role.",
      "Publish unlawful, misleading, discriminatory, infringing, malicious or otherwise prohibited content, or facilitate fraud or illicit transactions.",
      "Upload malware, attack security controls, enumerate account or order tokens, disrupt operations, scrape private data, or reverse-engineer protected systems except to the extent law expressly permits.",
      "Bypass quotas, request limits or payment entitlements, resell unauthorized platform access, or use bots to place false or abusive orders.",
      "Upload another person's private information without authorization or use the Service for unsolicited messages in violation of applicable law.",
      "Use AI, generated images or business listings to deceive customers about actual dishes, ingredients, product quality or other material facts.",
    ],
  },
  {
    id: "ai",
    title: "13. Assisted creation and AI output",
    paragraphs: [
      "If a Merchant enables automated import, transcription, translation, description assistance or image generation, the relevant inputs may be processed automatically for the enabled workflow and, once integrated, sent to the disclosed provider. The Merchant must ensure it has rights to the inputs and that they do not include unnecessary sensitive or third-party personal data. Exact providers, terms and data handling will be communicated before those integrations are activated.",
      "AI or optical extraction can generate incorrect prices, items, ingredients, imagery, descriptions or translations. It is a drafting aid, not a substitute for Merchant verification; a Merchant must review and approve customer-facing results, especially safety-related statements. We do not promise exclusive ownership, uniqueness, freedom from third-party claims or error-free output; intellectual-property rights in AI-generated material are governed by applicable law and relevant provider terms.",
      "Do not use AI output for illegal or deceptive purposes or represent generated images as actual food photographs without appropriate disclosure where a reasonable customer could be misled.",
    ],
  },
  {
    id: "platform-ip",
    title: "14. Our intellectual property and your limited license",
    paragraphs: [
      "BabaBuilds or its licensors retain rights in the MenuMinute software, interface, source code, original graphics, logos, templates, product documentation and other Service materials, except Merchant Content and properly licensed third-party components. Subject to these Terms, we grant you a limited, revocable, non-exclusive, non-transferable right to access and use the Service for its intended lawful purposes during your active entitlement.",
      "You may not copy or exploit our software, trade dress or trademarks beyond what is expressly permitted. If you choose to share general ideas or feedback about the Service, you permit us to consider and use them without compensation, but this does not give us ownership of your confidential business information or customer data.",
    ],
  },
  {
    id: "privacy",
    title: "15. Privacy, confidentiality and service records",
    paragraphs: [
      "Our separate Privacy Policy describes our proposed information practices and available privacy request channels. Confidential business information that is not intentionally published should only be accessed and used to deliver, secure and support the Service or as otherwise agreed or lawfully required. Public menus and content that a Merchant intentionally publishes are not confidential to their viewers.",
      "We may keep proportionate records necessary for security, dispute investigation, compliance and service operation. The data categories, provider contracts, retention periods and deletion mechanisms must be verified in the production Privacy Policy and operational inventory before final release. A Merchant must not use the Service as the sole legal archive for its own mandatory business records.",
    ],
  },
  {
    id: "availability",
    title: "16. Availability, maintenance and third-party services",
    paragraphs: [
      "We work to provide a useful and dependable Service, but may maintain, secure, update, repair or temporarily suspend a function. Internet access, third-party hosting, devices, network services, payment and AI providers can affect performance. Unless a separate written service-level commitment applies, we do not promise uninterrupted access, a particular response time or perpetual compatibility with every browser or device.",
      "Third-party links and integrations may have independent terms. We do not endorse a third party merely by displaying a link or future integration preview. Where an integration is essential to an activated feature, we will explain the relevant dependency and any additional agreement when appropriate.",
    ],
  },
  {
    id: "suspension",
    title: "17. Suspension, cancellation, termination and exports",
    paragraphs: [
      "You may stop using the Service and seek account closure or deletion through the available procedures, subject to verification, other organization members' rights and legally required retention. Future paid subscriptions must provide clear cancellation instructions before payment is authorized. Removing an app from a device alone may not cancel a separately purchased subscription.",
      "We may restrict content, disable a feature or suspend an account when reasonably needed for verified misuse, unauthorized access, nonpayment of an actually contracted amount, a serious legal or security concern, or material breach. We will use proportionate action and give notice and a chance to remedy when practicable, except where doing so would create an immediate risk or violate law.",
      "On expiration or cancellation of a paid plan, the intended model preserves an otherwise eligible published free QR menu, while paid ordering or kitchen entitlements may cease for new transactions. Already accepted legitimate orders should be handled safely under the applicable operational procedure. This design commitment remains subject to the finalized plan description and continuity safeguards; deletion, unlawful use and security suspension are separate cases.",
      "After termination, access, public links and data may be retained, exported, disabled or deleted as disclosed by the approved retention and closure policy and applicable law. Clauses intended by their nature to survive, including accrued payments, lawful records, IP, dispute resolution and permitted liability provisions, continue to the extent legally enforceable.",
    ],
  },
  {
    id: "warranties",
    title: "18. Service descriptions and warranty boundaries",
    paragraphs: [
      "We will provide the Service with reasonable care and skill required by applicable law. Product previews, illustrations and planned feature descriptions are not individual warranties. To the extent permitted by applicable law, we do not make additional implied promises that the Service will always be error-free, uninterrupted, suitable for a particular business outcome, or able to validate the legality, quality or safety of a Merchant's food and information.",
      "Any disclaimer in these Terms operates only to the extent legally permitted and does not remove mandatory consumer guarantees, fraud remedies, statutory duties or other rights that cannot lawfully be excluded.",
    ],
  },
  {
    id: "liability",
    title: "19. Allocation and limits of liability",
    paragraphs: [
      "Each party remains responsible for its own acts and legally imposed obligations. We are not a guarantor of a Merchant's food preparation, fulfillment, business licensing or independent customer representations, nor of a Guest's misuse of another person's QR link or device. We are responsible for our own Service-related obligations to the extent imposed by these Terms and law.",
      "To the maximum extent permitted by law, neither party is liable to the other for remote or unforeseeable indirect business losses, such as loss of prospective profits, arising solely from the Service, except where an exclusion is not legally effective. For a Merchant's ordinary contractual claim concerning a particular Service, BabaBuilds' aggregate liability is capped at the greater of (a) the fees actually paid to BabaBuilds for that Service in the 12 months before the event giving rise to the claim, or (b) INR 5,000, unless applicable law requires a higher amount or does not permit that limitation.",
      "The proposed cap and exclusions do not apply to liability that cannot lawfully be limited, including fraud, wilful misconduct, or legally non-excludable consumer, privacy, confidentiality, bodily injury, death or statutory obligations where applicable. No term limits a Guest's mandatory rights in relation to a food transaction or limits remedies required by applicable law.",
    ],
  },
  {
    id: "indemnity",
    title: "20. Merchant responsibility for third-party claims",
    paragraphs: [
      "To the extent permitted by applicable law, a Merchant will defend and indemnify BabaBuilds against reasonable third-party claims, liabilities and directly resulting costs caused by that Merchant's unlawful or infringing content, unauthorized use of third-party data, breach of its food-service obligations, or material misuse of the Service, except to the extent caused by our own negligence, unlawful conduct or breach. We will promptly notify the Merchant of a claim where practicable, allow reasonable participation in the defense, and not agree to a settlement imposing a non-monetary obligation on the Merchant without its consent.",
      "This provision is directed at business Merchants and is not intended to deprive Guests or other consumers of mandatory remedies.",
    ],
  },
  {
    id: "changes",
    title: "21. Updates to features and these Terms",
    paragraphs: [
      "We may improve or amend the Service and revise finalized Terms for valid operational, security, regulatory or commercial reasons. For material changes adversely affecting existing contracted use, we intend to give appropriate prior notice and, where law or contract requires, obtain fresh acceptance or provide a lawful termination or remedy. An unannounced future change does not retroactively create a fee, waive an accrued right or convert an optional feature into permission for unrelated processing.",
      "An approved Terms page will identify its effective and last-updated dates, and relevant acceptance records will be kept as required. Important account notices may be sent to the registered email or shown in the Service.",
    ],
  },
  {
    id: "disputes",
    title: "22. Governing law, questions and disputes",
    paragraphs: [
      "Subject to the mandatory laws and forums protecting users in their own jurisdiction, these Terms and disputes with BabaBuilds are proposed to be governed by the laws of India, with courts of competent jurisdiction in Rajasthan for claims where an exclusive forum can lawfully be agreed. This clause does not take away the right to approach a competent consumer commission, regulator, data-protection authority or another forum that mandatory law makes available.",
      "For a Service-related problem, please contact admin@bababuilds.com with sufficient details to investigate. We aim to resolve concerns informally where possible; requesting informal discussion does not suspend a statutory deadline, make arbitration compulsory, or prevent a complaint to an appropriate authority. Complaints about a Merchant's food and restaurant obligations should also be sent directly to that Merchant.",
    ],
  },
  {
    id: "mobile",
    title: "23. Web, PWA and future app-store distribution",
    paragraphs: [
      "These Service Terms are written to be capable of covering web/PWA use and a future Android or iOS client when actually released. Installing or accessing a native application does not transfer ownership of the software to you. Any applicable app-store rules, default license agreement, product-specific subscription terms and mandatory local laws also apply; in a conflict involving an app-store transaction, the store's binding mandatory requirements prevail to the required extent.",
      "We have not yet approved these Terms as a custom Apple end-user license agreement (EULA). If a custom EULA is selected, it must separately satisfy Apple's then-current minimum terms, including required contact details, license scope, support, warranty, product and intellectual-property claims, applicable compliance representations and Apple's third-party-beneficiary status. Until then the applicable store-standard EULA remains a separate matter. Purchases of digital software features in a native app must follow the relevant store's current billing rules and permitted exceptions.",
    ],
  },
  {
    id: "general",
    title: "24. General legal provisions and contact",
    paragraphs: [
      "If part of these Terms is held invalid or unenforceable, the rest continues to the extent legally possible without defeating a mandatory user right. Failure to enforce a clause once is not an automatic waiver. Neither party is liable for delay caused by events beyond its reasonable control to the extent permitted by law, but payment and statutory consumer obligations are not erased by a general force-majeure statement.",
      "A Merchant may not transfer its contract or account to another legal operator without our reasonable written consent where the transfer materially affects obligations or security; we may transfer the Service in a legitimate business reorganization subject to appropriate notice, continued obligations and applicable privacy law. These Terms, the effective Privacy Policy, applicable accepted checkout/plan terms and any properly executed supplemental agreement form the relevant agreement for their scopes.",
      "Operator: BabaBuilds (sole proprietorship), Pilani, Rajasthan, India. General legal and support contact: admin@bababuilds.com. The complete correspondence address, any required telephone contact and grievance/representative details must be confirmed by the operator before final publication or a custom native-app EULA is adopted.",
    ],
  },
];
