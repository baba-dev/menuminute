# PR E — Menu Studio 2.0

The main /dashboard/menu editor adopts MenuMinute's Ink & Ember treatment: integrated hero/nav actions, four overview cards, a filtered source-import review handoff, fast name/description search, one-click section navigation, clearer draft/live separation, responsive category/dish editing and continuously updated preview. Existing proven forms/commands remain intact for variants, add-ons, schedules, media, assignments and deliberate publication. Filtering never removes data from the draft; it preserves original category/dish indices.

PR D is the stable import contract: needs_review/ready sessions link directly to source-aware review; applied results only occur through PR D's transactional apply API. This UI does not apply unreviewed AI, auto-publish, introduce a second candidate format or expose private photos publicly.

CI: exact-head strict types, lint/style, integration, ARM64 browser and packaging. The browser menu-product scenario verifies search/import/preview and retained full editor interactions. Deploy through main→CI→publisher→deploy helper; distinguish staged-vs-active SHA and respect Auth 2.0 cutover approval.
