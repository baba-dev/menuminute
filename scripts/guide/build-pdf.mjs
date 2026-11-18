#!/usr/bin/env node
// Builds the bilingual User Guide PDF from src/content/guide/content.ts.
//   pnpm exec tsx scripts/guide/build-pdf.mjs [--out docs/user-guide/MenuMinute-User-Guide.pdf]
// Needs public/guide/{fonts,shots}. Chapter artwork is optional: public/guide/art/chapter-NN.jpg replaces
// the built-in placeholder illustration (see docs/user-guide/artwork-prompts.md).
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  SUPPORT,
  CONTACT_LINE,
  COVER,
  HOW_TO_READ,
  ROADMAP,
  CHAPTER_LIST,
} from "../../src/content/guide/content.ts";
import { CHAPTERS } from "../../src/content/guide/chapters.ts";
import { CH11, BACK_COVER } from "../../src/content/guide/help.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pub = join(root, "public/guide");
const url = (p) => pathToFileURL(join(pub, p)).href;
const logo = pathToFileURL(join(root, "public/brand/logos/logo-horizontal-light.svg")).href;
const marks = JSON.parse(readFileSync(join(pub, "shots/marks.json"), "utf8"));
const argOut = process.argv.indexOf("--out");
const outPdf = join(
  root,
  argOut > 0 ? process.argv[argOut + 1] : "docs/user-guide/MenuMinute-User-Guide.pdf"
);
mkdirSync(dirname(outPdf), { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bi = (b, cls = "") =>
  `<span class="en ${cls}">${esc(b.en)}</span><span class="hi ${cls}">${esc(b.hi)}</span>`;
const pad = (n) => String(n).padStart(2, "0");

const CSS = `
@font-face{font-family:"SG";font-weight:400;src:url(${url("fonts/space-grotesk-latin-400-normal.woff2")})}
@font-face{font-family:"SG";font-weight:500;src:url(${url("fonts/space-grotesk-latin-500-normal.woff2")})}
@font-face{font-family:"SG";font-weight:700;src:url(${url("fonts/space-grotesk-latin-700-normal.woff2")})}
@font-face{font-family:"NSD";font-weight:400;src:url(${url("fonts/noto-sans-devanagari-devanagari-400-normal.woff2")})}
@font-face{font-family:"NSD";font-weight:500;src:url(${url("fonts/noto-sans-devanagari-devanagari-500-normal.woff2")})}
@font-face{font-family:"NSD";font-weight:700;src:url(${url("fonts/noto-sans-devanagari-devanagari-700-normal.woff2")})}
:root{--bg:#FEF6E8;--ink:#231F36;--muted:#5B5868;--orange:#E8502A;--orange-d:#C23E1B;
 --cream:#FFF3E0;--mint:#E3EEDF;--lav:#EAE4F3;--blue:#E1EAF3;--line:#EBDFCB;--green:#2F6B4A}
@page{size:210mm 297mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg)}
body{font-family:"SG","NSD",sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{position:relative;width:210mm;height:297mm;overflow:hidden;background:var(--bg);page-break-after:always;break-after:page;padding:0 16mm}
.hi{font-family:"NSD","SG",sans-serif}
.en{display:block}.hi{display:block}
.top{display:flex;justify-content:space-between;align-items:center;height:30mm;padding-top:11mm}
.top img{height:12mm}
.run{font-size:7.5pt;letter-spacing:.14em;color:var(--muted);font-weight:500;text-transform:uppercase}
.foot{position:absolute;left:16mm;right:16mm;bottom:8mm;border-top:1px solid var(--line);padding-top:3mm;display:flex;justify-content:space-between;align-items:center;font-size:7pt;color:var(--muted);letter-spacing:.05em}
.foot b{color:var(--orange);font-weight:700;font-size:8.5pt}
.foot .fhelp{color:var(--ink);letter-spacing:.02em}
.eyebrow{font-size:8pt;letter-spacing:.16em;color:var(--orange);font-weight:700;text-transform:uppercase}
.eyebrow .hi{letter-spacing:.04em;font-size:9pt;margin-top:.6mm}
h1{font-weight:700;letter-spacing:-.02em}
h1 .en{font-size:30pt;line-height:1.08;color:var(--ink)}
h1 .hi{font-size:22pt;line-height:1.3;color:var(--orange);font-weight:700;margin-top:1.5mm}
.lead .en{font-size:11pt;line-height:1.45;color:var(--ink)}
.lead .hi{font-size:10.5pt;line-height:1.65;color:var(--muted);margin-top:1mm}
/* cover */
.cover .art{position:absolute;left:0;right:0;top:128mm;height:140mm}
.cover h1 .en{font-size:42pt}.cover h1 .hi{font-size:30pt}
.cover h1 .o{color:var(--orange)}
.strip{position:absolute;left:0;right:0;bottom:21mm;height:34mm;background:var(--orange);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 16mm}
.strip .en{font-size:10.5pt;font-weight:500}.strip .hi{font-size:9.5pt;opacity:.95}
.tag{display:inline-block;margin-top:5mm;padding:1mm 3.5mm;border:1px solid var(--orange);color:var(--orange);border-radius:99px;font-size:7.5pt;letter-spacing:.14em;font-weight:700}
.art{overflow:hidden;background:#F3C79B}
.art img,.art svg{display:block;width:100%;height:100%;object-fit:cover}
/* cards */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm}
.card{border-radius:5mm;padding:4.5mm}
.card.cream{background:var(--cream)}.card.mint{background:var(--mint)}.card.lav{background:var(--lav)}.card.blue{background:var(--blue)}
.card h3 .en{font-size:12.5pt;font-weight:700;line-height:1.25}.card h3 .hi{font-size:11.5pt;font-weight:700;line-height:1.5;color:var(--orange-d)}
.card p{margin-top:2mm}.card p .en{font-size:9.5pt;line-height:1.45}.card p .hi{font-size:9.5pt;line-height:1.65;color:var(--muted);margin-top:.5mm}
.sect{margin:5mm 0 2.5mm}
.sect h2 .en{font-size:15pt;font-weight:700}.sect h2 .hi{font-size:13pt;font-weight:700;color:var(--orange)}
.words{display:grid;grid-template-columns:1fr;gap:1.8mm}
.word{display:grid;grid-template-columns:30mm 1fr;gap:4mm;background:#fff;border:1px solid var(--line);border-radius:4mm;padding:2.2mm 4.5mm;align-items:center}
.word .t .en{font-weight:700;font-size:10pt}.word .t .hi{font-weight:700;font-size:9.5pt;color:var(--orange-d)}
.word .d .en{font-size:9pt;line-height:1.35}.word .d .hi{font-size:9pt;line-height:1.55;color:var(--muted)}
.roles{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.role{background:#fff;border:1px solid var(--line);border-radius:4mm;padding:4mm}
.role .r .en{font-weight:700;font-size:10pt}.role .r .hi{font-weight:700;font-size:9.5pt;color:var(--orange-d)}
.role .d{margin-top:1.5mm}.role .d .en{font-size:8.5pt;line-height:1.35}.role .d .hi{font-size:8.5pt;line-height:1.55;color:var(--muted)}
/* contents */
.toc{display:grid;grid-template-columns:1fr 1fr;gap:2.4mm 5mm}
.toc .row{display:grid;grid-template-columns:9mm 1fr;gap:3mm;align-items:center;background:#fff;border:1px solid var(--line);border-radius:4mm;padding:1.1mm 3mm}
.toc .n{width:8mm;height:8mm;border-radius:50%;background:var(--cream);color:var(--orange-d);font-weight:700;font-size:10pt;display:flex;align-items:center;justify-content:center}
.toc .row.on{border-color:var(--orange);background:#FFF1EA}.toc .row.on .n{background:var(--orange);color:#fff}
.toc .t .en{font-size:9.5pt;font-weight:700;line-height:1.25}.toc .t .hi{font-size:9pt;color:var(--muted);line-height:1.5}
.road{display:flex;flex-direction:column;gap:2.5mm}
.road .s{display:grid;grid-template-columns:11mm 1fr auto;gap:4mm;align-items:center;background:#fff;border:1px solid var(--line);border-radius:4mm;padding:1.8mm 4.5mm}
.road .k{width:9mm;height:9mm;border-radius:50%;background:var(--orange);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center}
.road .t .en{font-size:10.5pt;font-weight:500}.road .t .hi{font-size:10pt;color:var(--muted);line-height:1.55}
.road .c{font-size:8pt;font-weight:700;color:var(--orange-d);background:var(--cream);padding:1mm 3mm;border-radius:99px;white-space:nowrap}
/* chapter title page */
.chap .art{position:absolute;left:0;right:0;top:0;height:140mm}
.chap .art-fade{position:absolute;left:0;right:0;top:106mm;height:34mm;background:linear-gradient(to bottom,rgba(254,246,232,0),var(--bg))}
.chap .logo{position:absolute;left:16mm;top:11mm;background:rgba(255,246,232,.92);border-radius:4mm;padding:2mm 4mm}
.chap .logo img{height:11mm;display:block}
.chap .body{position:absolute;left:16mm;right:16mm;top:146mm}
.chap .big{font-size:78pt;font-weight:700;color:var(--orange);line-height:.9;letter-spacing:-.04em}
.chap .learn{margin-top:6mm;display:grid;grid-template-columns:1fr;gap:1.8mm}
.chap .learn .l{display:grid;grid-template-columns:6mm 1fr;gap:3mm;align-items:start}
.chap .learn .dot{width:5mm;height:5mm;border-radius:50%;background:var(--orange);margin-top:1mm}
.chap .learn .en{font-size:10pt;font-weight:500}.chap .learn .hi{font-size:9.5pt;color:var(--muted);line-height:1.5}
.chap h1 .en{font-size:34pt}.chap h1 .hi{font-size:26pt}
.chap .tagbar{position:absolute;left:0;right:0;bottom:25mm;background:var(--orange);color:#fff;padding:4mm 16mm}
.chap .tagbar .en{font-size:12pt;font-weight:700}.chap .tagbar .hi{font-size:11pt}
.chaphead{display:flex;gap:4mm;align-items:center}
/* step page */
.stepno{display:inline-flex;align-items:center;gap:2mm}
.stepno .b{background:var(--orange);color:#fff;border-radius:99px;padding:.6mm 3mm;font-size:8pt;letter-spacing:.12em}
.visuals{display:flex;gap:7mm;align-items:flex-start;margin-top:5mm}
.vwrap{position:relative}
.browser{background:#fff;border:1px solid #D9CDB8;border-radius:3.2mm;overflow:hidden;box-shadow:0 2.5mm 6mm rgba(80,50,20,.16)}
.browser .bar{height:5mm;background:#F1E8D8;display:flex;align-items:center;gap:1.2mm;padding:0 2.5mm;border-bottom:1px solid #E2D6C0}
.browser .bar i{width:1.7mm;height:1.7mm;border-radius:50%;background:#CDBFA8;display:block}
.shot{position:relative;line-height:0}
.shot img{width:100%;display:block}
.phone{background:#1E1B2B;border-radius:6.5mm;padding:1.7mm;box-shadow:0 2.5mm 6mm rgba(80,50,20,.22)}
.phone .shot{border-radius:5mm;overflow:hidden;background:#fff}
.box{position:absolute;border:.55mm solid var(--orange);border-radius:1.6mm;box-shadow:0 0 0 .4mm rgba(255,255,255,.85)}
.badge{position:absolute;width:5.2mm;height:5.2mm;border-radius:50%;background:var(--orange);color:#fff;font-weight:700;font-size:8pt;line-height:5.2mm;text-align:center;box-shadow:0 0 0 .5mm #fff;transform:translate(-50%,-50%)}
.cap{font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:1.8mm;text-align:center;line-height:1.3}
.cap .hi{letter-spacing:.02em;text-transform:none;font-size:7.5pt}
.ins{margin-top:6mm;display:flex;flex-direction:column;gap:3mm}
.ins .i{display:grid;grid-template-columns:8mm 1fr;gap:3.5mm;align-items:start}
.ins .k{width:7mm;height:7mm;border-radius:50%;background:var(--orange);color:#fff;font-weight:700;font-size:9.5pt;display:flex;align-items:center;justify-content:center;margin-top:.4mm}
.ins .k.plain{background:#fff;border:.4mm solid var(--orange);color:var(--orange)}
.ins .en{font-size:10.5pt;line-height:1.4;font-weight:500}.ins .hi{font-size:10pt;line-height:1.65;color:var(--muted);margin-top:.4mm}
.note{margin-top:5mm;border-radius:5mm;padding:4mm 5mm;display:grid;grid-template-columns:8mm 1fr;gap:3mm;align-items:start}
.note .ic{width:7mm;height:7mm;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:10pt}
.note.tip{background:var(--mint)}.note.tip .ic{background:var(--green)}
.note.warn{background:#FFE8DC}.note.warn .ic{background:var(--orange)}
.note .l{font-size:7.5pt;letter-spacing:.14em;font-weight:700;text-transform:uppercase}
.note.tip .l{color:var(--green)}.note.warn .l{color:var(--orange-d)}
.note .en{font-size:9.5pt;line-height:1.4}.note .hi{font-size:9.5pt;line-height:1.65;color:var(--muted)}
/* recap */
.checks{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
.checks .c{display:grid;grid-template-columns:7mm 1fr;gap:3.5mm;align-items:center;background:#fff;border:1px solid var(--line);border-radius:4mm;padding:1.6mm 4mm}
.checks .bx{width:5.5mm;height:5.5mm;border:.5mm solid var(--orange);border-radius:1.5mm}
.checks .en{font-size:10pt;font-weight:500}.checks .hi{font-size:9.5pt;color:var(--muted);line-height:1.55}
.faq{display:flex;flex-direction:column;gap:2.2mm}
.faq .f{border-radius:4.5mm;padding:3mm 5mm}
.faq .f:nth-child(1){background:var(--cream)}.faq .f:nth-child(2){background:var(--lav)}.faq .f:nth-child(3){background:var(--blue)}
.faq .q .en{font-weight:700;font-size:10.5pt}.faq .q .hi{font-weight:700;font-size:10pt;color:var(--orange-d)}
.faq .a{margin-top:1.6mm}.faq .a .en{font-size:9.5pt;line-height:1.4}.faq .a .hi{font-size:9.5pt;line-height:1.65;color:var(--muted)}
.help{margin-top:4mm;background:var(--orange);color:#fff;border-radius:5mm;padding:3.5mm 6mm}
.help .en{font-size:13pt;font-weight:700}.help .hi{font-size:12pt;font-weight:700}
.help .row{margin-top:2.5mm;font-size:10.5pt;display:flex;gap:8mm;font-weight:500}

/* colour pass: per-page accent themes, tinted header band, panels */
:root{--cream:#FFE6BF;--mint:#CDE7D3;--lav:#DDD0EF;--blue:#CBDFF2}
.t0{--a:#E8502A;--p:#FFDFCC}.t1{--a:#7A3E8E;--p:#E6D6F2}.t2{--a:#2F7D57;--p:#CFEAD8}.t3{--a:#2F6FA8;--p:#D2E4F7}.t4{--a:#C9810A;--p:#FFE6B0}
.page{--a:var(--orange);--p:#FFE3D2;isolation:isolate}
.band{position:absolute;left:0;right:0;top:0;height:96mm;z-index:-1;background:linear-gradient(180deg,var(--p) 0%,var(--p) 58%,var(--bg) 100%)}
.band svg{position:absolute;right:-6mm;top:-4mm;width:96mm;height:96mm}
.ghost{position:absolute;right:16mm;top:27mm;font-size:104pt;font-weight:700;line-height:1;color:var(--a);opacity:.2;z-index:-1;letter-spacing:-.04em}
.eyebrow{color:var(--a)}
h1 .hi{color:var(--a)}
.stepno .b{background:var(--a)}
.foot b{color:var(--a)}
.visuals{background:var(--p);border-radius:7mm;padding:5mm 5mm 3mm;gap:6mm;justify-content:center;margin-top:4mm}
.ins{margin-top:4mm;gap:2mm}
.ins .i{background:#fff;border-radius:4mm;padding:1.5mm 4mm;border-left:1.4mm solid var(--a)}
.note{margin-top:4mm}
.sect h2 .hi{color:var(--a)}
.chap .tagbar{background:var(--a)}.chap .learn .dot{background:var(--a)}
.chap .big{color:var(--a)}
.card.cream{border-top:2mm solid #F0A93B}.card.mint{border-top:2mm solid #4E9C6E}.card.lav{border-top:2mm solid #8E5BB0}.card.blue{border-top:2mm solid #4A89C4}
.word{border-left:1.4mm solid var(--a)}
.toc .row:nth-child(5n+1) .n{background:#FFDFCC;color:#C23E1B}.toc .row:nth-child(5n+2) .n{background:#E6D6F2;color:#7A3E8E}.toc .row:nth-child(5n+3) .n{background:#CFEAD8;color:#2F7D57}.toc .row:nth-child(5n+4) .n{background:#D2E4F7;color:#2F6FA8}.toc .row:nth-child(5n) .n{background:#FFE6B0;color:#9A6200}
.toc .row.on .n{background:var(--orange);color:#fff}
.road .s:nth-child(5n+1) .k{background:#E8502A}.road .s:nth-child(5n+2) .k{background:#7A3E8E}.road .s:nth-child(5n+3) .k{background:#2F7D57}.road .s:nth-child(5n+4) .k{background:#2F6FA8}.road .s:nth-child(5n) .k{background:#C9810A}
.checks .c{border-left:1.4mm solid var(--a)}
.dense .visuals{padding:3.5mm 4mm 2mm;margin-top:2.5mm}.dense .ins{margin-top:2.5mm;gap:1.4mm}.dense .note{margin-top:2.5mm;padding:3mm 4mm}.dense .lead{margin-top:2mm!important}
.toc .row{grid-template-columns:9mm 1fr auto}.toc .pg{font-size:8pt;font-weight:700;color:var(--orange-d)}
.fx{display:flex;flex-direction:column;gap:2.6mm;margin-top:3mm}.fx .f{border-radius:4.5mm;padding:3.4mm 5mm;border-left:1.6mm solid var(--a);background:#fff}
.fx .q .en{font-weight:700;font-size:10.5pt}.fx .q .hi{font-weight:700;font-size:10pt;color:var(--a)}.fx .a{margin-top:1.4mm}.fx .a .en{font-size:9.5pt;line-height:1.4}.fx .a .hi{font-size:9.5pt;line-height:1.65;color:var(--muted)}
.gl{display:grid;grid-template-columns:1fr 1fr;gap:2.6mm;margin-top:3mm}.gl .g{background:#fff;border:1px solid var(--line);border-left:1.6mm solid var(--a);border-radius:4mm;padding:2.6mm 4mm}
.gl .t .en{font-weight:700;font-size:10pt}.gl .t .hi{font-weight:700;font-size:9.5pt;color:var(--a)}.gl .d{margin-top:1mm}.gl .d .en{font-size:8.8pt;line-height:1.35}.gl .d .hi{font-size:8.8pt;line-height:1.55;color:var(--muted)}
.contact{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:6mm}.cbox{border-radius:6mm;padding:6mm;color:#fff}.cbox.e{background:var(--orange)}.cbox.w{background:#2F7D57}
.cbox .l{font-size:8pt;letter-spacing:.14em;font-weight:700;opacity:.9}.cbox .v{font-size:14pt;font-weight:700;margin-top:2mm}
.tell .i{display:grid;grid-template-columns:6mm 1fr;gap:3mm;align-items:center;margin-top:3mm;background:#fff;border:1px solid var(--line);border-left:1.6mm solid var(--a);border-radius:4mm;padding:4mm 5mm}.tell .dot{width:5mm;height:5mm;border-radius:50%;background:var(--a)}.tell .en{font-size:11pt;font-weight:500}.tell .hi{font-size:10.5pt;color:var(--muted);line-height:1.6}
.back .art{position:absolute;left:0;right:0;top:0;height:140mm}.back .over{position:absolute;left:94mm;top:18mm;width:62mm;text-align:left}
.back .over .big .en{font-size:34pt;font-weight:700;color:#5A1F10;line-height:1.05}.back .over .big .hi{font-size:28pt;font-weight:700;color:#8A2A12;line-height:1.3}
.back .over .sm{margin-top:4mm}.back .over .sm .en{font-size:10.5pt;font-weight:500;color:#5A1F10}.back .over .sm .hi{font-size:10pt;color:#6B2A18;line-height:1.6}
`;

/** Placeholder scene used until public/guide/art/chapter-NN.jpg exists. */
function placeholderArt(n) {
  const hue = [
    ["#F6C98F", "#E8745A"],
    ["#F2D2A5", "#C9603E"],
    ["#F4BE8A", "#B5483A"],
  ][n % 3];
  return `<svg viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="g${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hue[0]}"/><stop offset="1" stop-color="${hue[1]}"/></linearGradient>
<radialGradient id="l${n}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE9A8"/><stop offset="1" stop-color="#FFE9A800"/></radialGradient></defs>
<rect width="1536" height="1024" fill="url(#g${n})"/>
<path d="M430 1024V470a338 338 0 0 1 676 0v554z" fill="#FFF0D6" opacity=".55"/>
<path d="M500 1024V480a268 268 0 0 1 536 0v544z" fill="#FFD9A0" opacity=".7"/>
<g stroke="#7A3B24" stroke-width="6" opacity=".35"><path d="M768 212v812M500 560h536M500 780h536"/></g>
<g><circle cx="300" cy="290" r="150" fill="url(#l${n})"/><circle cx="1236" cy="290" r="150" fill="url(#l${n})"/>
<path d="M300 0v200M1236 0v200" stroke="#6B3A22" stroke-width="5"/>
<path d="M240 250a60 40 0 0 1 120 0z" fill="#C98B2B"/><path d="M1176 250a60 40 0 0 1 120 0z" fill="#C98B2B"/></g>
<g fill="#2F6B4A"><path d="M80 1024c20-220 70-340 160-420 10 150-10 300-60 420z"/><path d="M200 1024c-10-200 30-330 120-400 30 130 10 280-30 400z" fill="#3E7F58"/>
<path d="M1456 1024c-20-220-70-340-160-420-10 150 10 300 60 420z"/><path d="M1336 1024c10-200-30-330-120-400-30 130-10 280 30 400z" fill="#3E7F58"/></g>
<rect x="0" y="800" width="1536" height="224" fill="#8A3F2C" opacity=".85"/>
<g fill="#FFF0D6" opacity=".9"><ellipse cx="520" cy="850" rx="150" ry="30"/><ellipse cx="1016" cy="850" rx="150" ry="30"/></g>
<g fill="#E8502A"><circle cx="520" cy="826" r="40"/><circle cx="1016" cy="826" r="40"/></g>
</svg>`;
}

function art(n) {
  const jpg = join(root, `docs/user-guide/out/art/chapter-${pad(n)}.jpg`);
  return existsSync(jpg) ? `<img src="${pathToFileURL(jpg).href}" alt="">` : placeholderArt(n);
}

const band = (ghost = "") =>
  `<div class="band"><svg viewBox="0 0 100 100"><path d="M8 100V52a42 42 0 0 1 84 0v48z" style="fill:var(--a);opacity:.16"/><path d="M20 100V54a30 30 0 0 1 60 0v46z" style="fill:var(--a);opacity:.16"/><path d="M8 100V52a42 42 0 0 1 84 0v48" style="fill:none;stroke:var(--a);stroke-width:.8;opacity:.5"/></svg></div>${ghost ? `<div class="ghost">${ghost}</div>` : ""}`;
// Chromium stores WebP losslessly in PDFs (huge); re-encode screenshots as JPEG for a print-friendly size.
{
  const outDir = join(root, "docs/user-guide/out/shots");
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(join(pub, "shots")).filter((n) => n.endsWith(".webp"))) {
    // Phone shots are shown ~40 mm wide: 520 px is ~330 dpi, plenty for print.
    const img = sharp(join(pub, "shots", f));
    await (
      f.includes("-mobile")
        ? img.resize({ width: 520 })
        : img.resize({ width: 1200, withoutEnlargement: true })
    )
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 76, mozjpeg: true })
      .toFile(join(outDir, f.replace(/\.webp$/, ".jpg")));
  }
}
{
  const artOut = join(root, "docs/user-guide/out/art");
  mkdirSync(artOut, { recursive: true });
  for (const f of existsSync(join(pub, "art"))
    ? readdirSync(join(pub, "art")).filter((n) => n.endsWith(".jpg"))
    : []) {
    await sharp(join(pub, "art", f))
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(join(artOut, f));
  }
}
// Page plan: cover, how-to, contents, then each chapter (title + steps + recap), help chapter, back cover.
const startPage = {};
{
  let n = 4;
  for (const c of CHAPTERS) {
    startPage[c.no] = n;
    n += c.steps.length + 2;
  }
  startPage[11] = n;
}
let pageNo = 0;
const footer = () => {
  pageNo += 1;
  return `<div class="foot"><span>MENUMINUTE · A SUBSIDIARY OF BABABUILDS.COM</span>
<span class="fhelp">✉ ${SUPPORT.email} &nbsp;·&nbsp; WhatsApp ${SUPPORT.whatsapp}</span><b>${pad(pageNo)}</b></div>`;
};
const top = (label) =>
  `<div class="top"><img src="${logo}" alt="MenuMinute"><span class="run">${esc(label)}</span></div>`;

function cover() {
  pageNo += 1;
  return `<section class="page cover">
${top("Made for restaurant owners · रेस्टोरेंट मालिकों के लिए")}
<div class="eyebrow">${bi(COVER.eyebrow)}</div>
<h1 style="margin-top:6mm"><span class="en">${esc(COVER.line1.en)}</span><span class="en o">${esc(COVER.line2.en)}</span>
<span class="hi">${esc(COVER.line1.hi)} ${esc(COVER.line2.hi)}</span></h1>
<div class="lead" style="margin-top:6mm;width:150mm">${bi(COVER.sub)}</div>
<span class="tag">FIRST EDITION · पहला संस्करण</span>
<div class="art">${art(0)}</div>
<div class="strip">${bi(COVER.strip)}</div>
<div class="foot"><span>MENUMINUTE · A SUBSIDIARY OF BABABUILDS.COM</span><span class="fhelp">✉ ${SUPPORT.email} &nbsp;·&nbsp; WhatsApp ${SUPPORT.whatsapp}</span><b>01</b></div>
</section>`;
}

function howTo() {
  const h = HOW_TO_READ;
  return `<section class="page t3">${band()}
${top("Start here · यहाँ से शुरू करें")}
<div class="eyebrow">${bi({ en: "BEFORE YOU BEGIN", hi: "शुरू करने से पहले" })}</div>
<h1 style="margin-top:3mm">${bi(h.title)}</h1>
<div class="lead" style="margin-top:4mm">${bi(h.intro)}</div>
<div class="grid" style="margin-top:5mm">${h.cards
    .map((c) => `<div class="card ${c.tone}"><h3>${bi(c.title)}</h3><p>${bi(c.text)}</p></div>`)
    .join("")}</div>
<div class="sect"><h2>${bi(h.wordsTitle)}</h2></div>
<div class="words">${h.words
    .map(
      (w) =>
        `<div class="word"><div class="t">${bi(w.term)}</div><div class="d">${bi(w.text)}</div></div>`
    )
    .join("")}</div>
${footer()}</section>`;
}

function contents() {
  return `<section class="page t4">${band()}
${top("Start here · यहाँ से शुरू करें")}
<div class="eyebrow">${bi({ en: "WHAT IS INSIDE", hi: "अंदर क्या है" })}</div>
<h1 style="margin-top:3mm">${bi({ en: "Chapters and your first day", hi: "चैप्टर और आपका पहला दिन" })}</h1>
<div class="sect"><h2>${bi(ROADMAP.title)}</h2></div>
<div class="road">${ROADMAP.steps
    .map(
      (s, i) =>
        `<div class="s"><div class="k">${i + 1}</div><div class="t">${bi(s.text)}</div><div class="c">Chapter ${s.ch} · p. ${startPage[s.ch]}</div></div>`
    )
    .join("")}</div>
<div class="sect"><h2>${bi({ en: "All chapters", hi: "सारे चैप्टर" })}</h2></div>
<div class="toc">${CHAPTER_LIST.map(
    (c) =>
      `<div class="row"><div class="n">${c.no}</div><div class="t">${bi(c.title)}</div><div class="pg">p. ${startPage[c.no]}</div></div>`
  ).join("")}</div>
${footer()}</section>`;
}

function chapterTitle(ch) {
  return `<section class="page chap t${(ch.no - 1) % 5}">
<div class="art">${art(ch.no)}</div><div class="art-fade"></div>
<div class="logo"><img src="${logo}" alt="MenuMinute"></div>
<div class="body">
<div class="eyebrow">${bi({ en: `CHAPTER ${ch.no}`, hi: `अध्याय ${ch.no}` })}</div>
<h1 style="margin-top:3mm">${bi(ch.title)}</h1>
<div class="learn">${ch.learn.map((l) => `<div class="l"><span class="dot"></span><div>${bi(l)}</div></div>`).join("")}</div>
</div>
<div class="tagbar">${bi(ch.tagline)}</div>
<div class="foot"><span>MENUMINUTE · A SUBSIDIARY OF BABABUILDS.COM</span><span class="fhelp">✉ ${SUPPORT.email} &nbsp;·&nbsp; WhatsApp ${SUPPORT.whatsapp}</span><b>${pad((pageNo += 1))}</b></div>
</section>`;
}

function shotHtml(id, view, kind, used) {
  const webp = join(pub, `shots/${id}-${view}.webp`);
  if (!existsSync(webp)) return "";
  const file = join(root, "docs/user-guide/out/shots", `${id}-${view}.jpg`);
  const m = (marks[`${id}-${view}`] ?? [])
    .filter((k) => !used || used.has(k.n))
    .map(
      (k) =>
        `<div class="box" style="left:${k.x}%;top:${k.y}%;width:${k.w}%;height:${k.h}%"></div><div class="badge" style="left:${Math.max(k.x, 1.5)}%;top:${Math.max(k.y, 1.5)}%">${k.n}</div>`
    )
    .join("");
  const img = `<div class="shot"><img src="${pathToFileURL(file).href}" alt="">${m}</div>`;
  return kind === "desktop"
    ? `<div class="browser"><div class="bar"><i></i><i></i><i></i></div>${img}</div>`
    : `<div class="phone">${img}</div>`;
}

function stepPage(ch, s) {
  const dW = s.desktop && s.mobile ? (s.compact ? "94mm" : "114mm") : "100%";
  const pW = s.compact ? "34mm" : "40mm";
  const used = new Set(s.instructions.filter((i) => i.mark).map((i) => i.mark));
  return `<section class="page${s.compact ? " dense" : ""} t${(s.no - 1) % 5}">${band(s.no)}
${top(`Chapter ${ch.no} · ${ch.title.en} · अध्याय ${ch.no}`)}
<div class="eyebrow stepno"><span class="b">STEP ${s.no} · चरण ${s.no}</span></div>
<h1 style="margin-top:3mm">${bi(s.title)}</h1>
<div class="lead" style="margin-top:3mm">${bi(s.intro)}</div>
<div class="visuals">
${s.desktop ? `<div class="vwrap" style="width:${dW}">${shotHtml(s.desktop, "desktop", "desktop", used)}<div class="cap">On a computer <span class="hi">कंप्यूटर पर</span></div></div>` : ""}
${s.mobile ? `<div class="vwrap" style="width:${pW}">${shotHtml(s.mobile, "mobile", "phone", used)}<div class="cap">On a phone <span class="hi">फ़ोन पर</span></div></div>` : ""}
</div>
<div class="ins">${s.instructions
    .map(
      (i) =>
        `<div class="i"><div class="k ${i.mark ? "" : "plain"}">${i.mark ?? "•"}</div><div>${bi(i.text)}</div></div>`
    )
    .join("")}</div>
${s.tip ? `<div class="note tip"><div class="ic">✓</div><div><div class="l">Tip · सुझाव</div>${bi(s.tip)}</div></div>` : ""}
${s.warn ? `<div class="note warn"><div class="ic">!</div><div><div class="l">Be careful · सावधानी</div>${bi(s.warn)}</div></div>` : ""}
${footer()}</section>`;
}

function recap(ch) {
  return `<section class="page t${(ch.no - 1) % 5}">${band("✓")}
${top(`Chapter ${ch.no} · ${ch.title.en} · अध्याय ${ch.no}`)}
<div class="eyebrow">${bi({ en: "WRAP UP", hi: "समेटते हैं" })}</div>
<h1 style="margin-top:3mm">${bi({ en: "Before you move on", hi: "आगे बढ़ने से पहले" })}</h1>
<div class="sect"><h2>${bi({ en: "I can…", hi: "मैं यह कर सकता/सकती हूँ…" })}</h2></div>
<div class="checks">${ch.recap.checks.map((c) => `<div class="c"><div class="bx"></div><div>${bi(c)}</div></div>`).join("")}</div>
<div class="sect"><h2>${bi({ en: "If something looks wrong", hi: "कुछ गड़बड़ लगे तो" })}</h2></div>
<div class="faq">${ch.recap.faqs.map((f) => `<div class="f"><div class="q">${bi(f.q)}</div><div class="a">${bi(f.a)}</div></div>`).join("")}</div>
<div class="help"><div>${bi(CONTACT_LINE)}</div>
<div class="row"><span>✉ ${SUPPORT.email}</span><span>WhatsApp ${SUPPORT.whatsapp}</span></div></div>
${footer()}</section>`;
}

function fixesPage(items, part) {
  return `<section class="page t${(CH11.no - 1) % 5}">${band(part)}
${top(`Chapter ${CH11.no} · ${CH11.title.en} · अध्याय ${CH11.no}`)}
<div class="eyebrow">${bi({ en: "TROUBLESHOOTING", hi: "समस्या का हल" })}</div>
<h1 style="margin-top:3mm">${bi(CH11.fixTitle)}</h1>
<div class="fx">${items.map((f) => `<div class="f"><div class="q">${bi(f.q)}</div><div class="a">${bi(f.a)}</div></div>`).join("")}</div>
${footer()}</section>`;
}

function glossaryPage() {
  return `<section class="page t${(CH11.no - 1) % 5}">${band("A–Z")}
${top(`Chapter ${CH11.no} · ${CH11.title.en} · अध्याय ${CH11.no}`)}
<div class="eyebrow">${bi({ en: "GLOSSARY", hi: "शब्दकोश" })}</div>
<h1 style="margin-top:3mm">${bi(CH11.glossaryTitle)}</h1>
<div class="gl">${CH11.glossary.map((g) => `<div class="g"><div class="t">${bi(g.term)}</div><div class="d">${bi(g.text)}</div></div>`).join("")}</div>
${footer()}</section>`;
}

function contactPage() {
  const c = CH11.contact;
  return `<section class="page t${(CH11.no - 1) % 5}">${band("☎")}
${top(`Chapter ${CH11.no} · ${CH11.title.en} · अध्याय ${CH11.no}`)}
<div class="eyebrow">${bi({ en: "CONTACT", hi: "संपर्क" })}</div>
<h1 style="margin-top:3mm">${bi(c.title)}</h1>
<div class="lead" style="margin-top:3mm">${bi(c.intro)}</div>
<div class="contact">
<div class="cbox e"><div class="l">EMAIL SUPPORT · ईमेल सहायता</div><div class="v">${SUPPORT.email}</div></div>
<div class="cbox w"><div class="l">WHATSAPP SUPPORT · व्हाट्सऐप सहायता</div><div class="v">${SUPPORT.whatsapp}</div></div>
</div>
<div class="sect"><h2>${bi(c.tellUs)}</h2></div>
<div class="tell">${c.items.map((i) => `<div class="i"><span class="dot"></span><div>${bi(i)}</div></div>`).join("")}</div>
${footer()}</section>`;
}

function backCover() {
  pageNo += 1;
  return `<section class="page back t0">
<div class="art">${art(12)}<div class="over"><div class="big">${bi(BACK_COVER.thanks)}</div><div class="sm">${bi(BACK_COVER.line)}</div></div></div>
<div style="position:absolute;left:16mm;right:16mm;top:150mm">
<div class="eyebrow">${bi({ en: "NEED A HAND?", hi: "मदद चाहिए?" })}</div>
<div class="contact" style="margin-top:4mm">
<div class="cbox e"><div class="l">EMAIL SUPPORT · ईमेल सहायता</div><div class="v">${SUPPORT.email}</div></div>
<div class="cbox w"><div class="l">WHATSAPP SUPPORT · व्हाट्सऐप सहायता</div><div class="v">${SUPPORT.whatsapp}</div></div>
</div>
<div style="margin-top:10mm;display:flex;align-items:center;gap:6mm"><img src="${logo}" alt="MenuMinute" style="height:14mm"><div style="font-size:8pt;letter-spacing:.12em;color:var(--muted)">MENUMINUTE · A SUBSIDIARY OF BABABUILDS.COM</div></div>
</div>
<div class="strip" style="bottom:0;height:12mm;flex-direction:row;align-items:center"><span class="en" style="font-size:9pt">© MenuMinute · ${bi({ en: "User Operation Guide", hi: "उपयोग की गाइड" }).replace(/<[^>]+>/g, " ")}</span></div>
</section>`;
}

const fixHalf = Math.ceil(CH11.fixes.length / 2);
const pages = [
  cover(),
  howTo(),
  contents(),
  ...CHAPTERS.flatMap((ch) => [
    chapterTitle(ch),
    ...ch.steps.map((st) => stepPage(ch, st)),
    recap(ch),
  ]),
  chapterTitle(CH11),
  fixesPage(CH11.fixes.slice(0, fixHalf), "?"),
  fixesPage(CH11.fixes.slice(fixHalf), "?"),
  glossaryPage(),
  contactPage(),
  backCover(),
];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>MenuMinute User Operation Guide</title><style>${CSS}</style></head><body>${pages.join("\n")}</body></html>`;
const htmlPath = join(root, "docs/user-guide/out", "guide-build.html"); // out/ is git-ignored
mkdirSync(dirname(htmlPath), { recursive: true });
writeFileSync(htmlPath, html);

const browser = await chromium.launch({
  executablePath: existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined,
  args: ["--no-sandbox", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: outPdf,
  width: "210mm",
  height: "297mm",
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log("wrote", outPdf, `${pages.length} pages`);
