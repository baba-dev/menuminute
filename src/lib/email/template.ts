/**
 * The one MenuMinute email layout. It takes the app origin as an argument and reads no environment, so
 * the worker (which has no web environment) can render with it too.
 * Every transactional message (sign-in links, invitations, plan
 * reminders, ...) renders through `renderEmail`, so they all share the same look and the same safety
 * rules:
 *  - table layout with inline styles only (mail clients strip <style> blocks and ignore flex/grid),
 *    plus a small <style> block that only adds dark mode and the phone breakpoint;
 *  - every piece of text is HTML-escaped, and every link must be on this app's own origin;
 *  - a plain-text twin is always produced, with the action link first so it is easy to find;
 *  - no remote fonts or scripts. The only remote asset is the approved brand symbol from /brand.
 */
export type EmailTone = "info" | "warn" | "alert";

export type EmailContent = Readonly<{
  /** Short summary shown next to the subject in inboxes; hidden in the message itself. */
  preheader: string;
  /** Small coloured label above the heading, e.g. "Your trial". */
  eyebrow?: string;
  heading: string;
  /** Paragraphs of plain text. Blank strings are ignored. */
  paragraphs: readonly string[];
  /** Key facts shown as a quiet panel, e.g. [{label:"Trial ends", value:"12 Nov 2026"}]. */
  facts?: readonly { label: string; value: string }[];
  /** The one thing the reader should do. `url` must be on the app origin. */
  action?: Readonly<{ label: string; url: string }>;
  /** Fine print under the button, e.g. "The link expires automatically." */
  note?: string;
  /** Colour of the eyebrow and the fact panel accent. */
  tone?: EmailTone;
}>;

export type RenderedEmail = Readonly<{ html: string; text: string }>;

const TONES: Record<
  EmailTone,
  { accent: string; accentDark: string; tint: string; tintDark: string }
> = {
  info: { accent: "#c2410c", accentDark: "#fb923c", tint: "#fff4e8", tintDark: "#2c2118" },
  warn: { accent: "#b45309", accentDark: "#fbbf24", tint: "#fff8e1", tintDark: "#2b2412" },
  alert: { accent: "#b91c1c", accentDark: "#f87171", tint: "#fdecec", tintDark: "#2d1717" },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Throws unless `url` is on this app's own origin. Email links must never point elsewhere. */
export function assertAppUrl(url: string, appUrl: string): URL {
  const target = new URL(url);
  const app = new URL(appUrl);
  if (target.origin !== app.origin || target.protocol !== app.protocol)
    throw new Error("Invalid email link destination");
  return target;
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderEmail(content: EmailContent, appUrl: string): RenderedEmail {
  const tone = TONES[content.tone ?? "info"];
  const origin = new URL(appUrl).origin;
  const action = content.action
    ? { ...content.action, url: assertAppUrl(content.action.url, appUrl).toString() }
    : null;
  const paragraphs = content.paragraphs.filter((p) => p.trim().length > 0);

  const paragraphHtml = paragraphs
    .map(
      (p) =>
        `<p class="mm-text" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:#3b2f27;">${escapeHtml(p)}</p>`
    )
    .join("");

  const factsHtml = content.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mm-panel" style="margin:4px 0 22px;background:${tone.tint};border-radius:12px;border-left:4px solid ${tone.accent};">
        <tr><td style="padding:16px 20px;">
          ${content.facts
            .map(
              (f, i) =>
                `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${i ? ' style="margin-top:10px;"' : ""}><tr>
                  <td class="mm-muted" style="font-family:${FONT};font-size:13px;color:#7a6a5d;padding-right:12px;">${escapeHtml(f.label)}</td>
                  <td class="mm-strong" align="right" style="font-family:${FONT};font-size:15px;font-weight:600;color:#2a1d14;">${escapeHtml(f.value)}</td>
                </tr></table>`
            )
            .join("")}
        </td></tr>
      </table>`
    : "";

  const buttonHtml = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px;"><tr>
        <td align="center" bgcolor="#e8590c" style="border-radius:10px;background:#e8590c;">
          <a href="${escapeHtml(action.url)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(action.label)}</a>
        </td>
      </tr></table>
      <p class="mm-muted" style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.5;color:#7a6a5d;">If the button does not work, paste this address into your browser:<br><a class="mm-link" href="${escapeHtml(action.url)}" style="color:${tone.accent};word-break:break-all;">${escapeHtml(action.url)}</a></p>`
    : "";

  const noteHtml = content.note
    ? `<p class="mm-muted" style="margin:14px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:#7a6a5d;">${escapeHtml(content.note)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(content.heading)}</title>
<style>
  @media (max-width:620px){ .mm-card{border-radius:0 !important;} .mm-pad{padding:28px 22px !important;} .mm-h1{font-size:24px !important;} }
  @media (prefers-color-scheme:dark){
    .mm-bg{background:#14100d !important;} .mm-card{background:#1e1813 !important;}
    .mm-h1,.mm-strong{color:#fbeedd !important;} .mm-text{color:#e3d3c2 !important;} .mm-muted{color:#b3a090 !important;}
    .mm-panel{background:${tone.tintDark} !important;} .mm-rule{border-color:#33291f !important;}
    .mm-eyebrow,.mm-link{color:${tone.accentDark} !important;}
  }
</style>
</head>
<body class="mm-bg" style="margin:0;padding:0;background:#fbf6ee;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(content.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mm-bg" style="background:#fbf6ee;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td style="padding:0 8px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:10px;"><img src="${escapeHtml(origin)}/brand/icons/pwa/icon-192.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px;"></td>
          <td style="font-family:${FONT};font-size:19px;font-weight:800;letter-spacing:-0.2px;color:#e8590c;">MenuMinute</td>
        </tr></table>
      </td></tr>
      <tr><td class="mm-card" style="background:#ffffff;border-radius:18px;box-shadow:0 1px 3px rgba(60,40,20,0.08);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="mm-pad" style="padding:36px 36px 30px;">
          ${content.eyebrow ? `<p class="mm-eyebrow" style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${tone.accent};">${escapeHtml(content.eyebrow)}</p>` : ""}
          <h1 class="mm-h1" style="margin:0 0 18px;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.4px;color:#2a1d14;">${escapeHtml(content.heading)}</h1>
          ${paragraphHtml}
          ${factsHtml}
          ${buttonHtml}
          ${noteHtml}
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:20px 12px 0;">
        <p class="mm-muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:#7a6a5d;text-align:center;">MenuMinute by BabaBuilds<br>You are receiving this because of activity on your MenuMinute account.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const lines: string[] = [content.heading, ""];
  for (const p of paragraphs) lines.push(p, "");
  if (content.facts?.length) {
    for (const f of content.facts) lines.push(`${f.label}: ${f.value}`);
    lines.push("");
  }
  if (action) lines.push(`${action.label}:`, action.url, "");
  if (content.note) lines.push(content.note, "");
  lines.push("MenuMinute by BabaBuilds");
  return { html, text: lines.join("\n") };
}
