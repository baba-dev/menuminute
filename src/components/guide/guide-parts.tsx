import React from "react";
import Image from "next/image";
import { Lightbulb, AlertTriangle } from "lucide-react";
import marksJson from "../../../public/guide/shots/marks.json";
import type { Bi, GuideChapter, GuideStep } from "@/content/guide/content";

type Mark = { n: number; x: number; y: number; w: number; h: number };
const MARKS = marksJson as Record<string, Mark[]>;

/** English first, Hindi directly below. Hindi gets lang="hi" for screen readers and font fallback. */
export function Bilingual({
  text,
  enClass = "",
  hiClass = "",
}: {
  text: Bi;
  enClass?: string;
  hiClass?: string;
}) {
  return (
    <>
      <span className={`block ${enClass}`}>{text.en}</span>
      <span lang="hi" className={`block ${hiClass}`}>
        {text.hi}
      </span>
    </>
  );
}

export function ChapterArt({ no, priority = false }: { no: number; priority?: boolean }) {
  const name = `/guide/art/chapter-${String(no).padStart(2, "0")}.jpg`;
  return (
    <Image
      src={name}
      alt=""
      width={1536}
      height={1024}
      sizes="(max-width: 768px) 100vw, 896px"
      priority={priority}
      className="h-auto w-full object-cover"
    />
  );
}

function Shot({
  id,
  view,
  used,
  alt,
}: {
  id: string;
  view: "desktop" | "mobile";
  used: Set<number>;
  alt: string;
}) {
  const marks = (MARKS[`${id}-${view}`] ?? []).filter((m) => used.has(m.n));
  const wide = view === "desktop";
  return (
    <figure className={wide ? "w-full md:flex-1" : "mx-auto w-44 shrink-0 sm:w-48"}>
      <div
        className={
          wide
            ? "relative overflow-hidden rounded-xl border border-stone-300 bg-white shadow-md"
            : "relative overflow-hidden rounded-[1.6rem] border-[5px] border-stone-800 bg-white shadow-md"
        }
      >
        <Image
          src={`/guide/shots/${id}-${view}.webp`}
          alt={alt}
          width={wide ? 1400 : 780}
          height={wide ? 800 : 1688}
          sizes={wide ? "(max-width: 768px) 100vw, 560px" : "200px"}
          className="h-auto w-full"
        />
        {marks.map((m) => (
          <React.Fragment key={m.n}>
            <span
              aria-hidden="true"
              className="absolute rounded-md border-2 border-orange-600"
              style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-orange-600 text-[11px] font-bold text-white ring-2 ring-white"
              style={{ left: `${Math.max(m.x, 2)}%`, top: `${Math.max(m.y, 2)}%` }}
            >
              {m.n}
            </span>
          </React.Fragment>
        ))}
      </div>
      <figcaption className="text-muted-foreground mt-2 text-center text-xs">
        {wide ? "On a computer · कंप्यूटर पर" : "On a phone · फ़ोन पर"}
      </figcaption>
    </figure>
  );
}

export function StepView({ chapter, step }: { chapter: GuideChapter; step: GuideStep }) {
  const used = new Set(step.instructions.flatMap((i) => (i.mark ? [i.mark] : [])));
  const alt = `${chapter.title.en}: ${step.title.en}`;
  return (
    <section
      id={`step-${step.no}`}
      className="scroll-mt-24 rounded-3xl border border-stone-200 bg-orange-50/60 p-5 sm:p-8 dark:border-stone-800 dark:bg-stone-900"
    >
      <p className="inline-block rounded-full bg-orange-600 px-3 py-1 text-xs font-bold tracking-wider text-white">
        STEP {step.no} · चरण {step.no}
      </p>
      <h2 className="font-display mt-3 text-2xl font-extrabold sm:text-3xl">
        <Bilingual text={step.title} hiClass="text-orange-600 mt-1" />
      </h2>
      <p className="mt-3 max-w-3xl leading-relaxed">
        <Bilingual text={step.intro} hiClass="text-muted-foreground mt-1" />
      </p>
      {(step.desktop || step.mobile) && (
        <div className="mt-6 flex flex-col items-start gap-6 md:flex-row">
          {step.desktop && <Shot id={step.desktop} view="desktop" used={used} alt={alt} />}
          {step.mobile && <Shot id={step.mobile} view="mobile" used={used} alt={alt} />}
        </div>
      )}
      <ol className="mt-6 space-y-3">
        {step.instructions.map((i, idx) => (
          <li
            key={idx}
            className="flex gap-3 rounded-2xl border-l-4 border-orange-600 bg-white p-3 dark:bg-stone-950"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-600 text-sm font-bold text-white">
              {i.mark ?? "•"}
            </span>
            <span>
              <Bilingual
                text={i.text}
                enClass="font-medium"
                hiClass="text-muted-foreground mt-0.5"
              />
            </span>
          </li>
        ))}
      </ol>
      {step.tip && (
        <aside className="mt-5 flex gap-3 rounded-2xl bg-emerald-100/70 p-4 dark:bg-emerald-950/40">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-300">
              Tip · सुझाव
            </p>
            <Bilingual text={step.tip} hiClass="text-muted-foreground" />
          </div>
        </aside>
      )}
      {step.warn && (
        <aside className="mt-5 flex gap-3 rounded-2xl bg-orange-100 p-4 dark:bg-orange-950/40">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange-700" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold tracking-wider text-orange-800 uppercase dark:text-orange-300">
              Be careful · सावधानी
            </p>
            <Bilingual text={step.warn} hiClass="text-muted-foreground" />
          </div>
        </aside>
      )}
    </section>
  );
}

export function Recap({ chapter }: { chapter: GuideChapter }) {
  return (
    <section className="rounded-3xl border border-stone-200 p-5 sm:p-8 dark:border-stone-800">
      <h2 className="font-display text-2xl font-extrabold">
        <Bilingual
          text={{ en: "Before you move on", hi: "आगे बढ़ने से पहले" }}
          hiClass="text-orange-600"
        />
      </h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {chapter.recap.checks.map((c, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-xl border border-stone-200 p-3 dark:border-stone-800"
          >
            <span
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 rounded border-2 border-orange-600"
            />
            <span>
              <Bilingual text={c} hiClass="text-muted-foreground" />
            </span>
          </li>
        ))}
      </ul>
      <h3 className="font-display mt-8 text-xl font-bold">
        <Bilingual
          text={{ en: "If something looks wrong", hi: "कुछ गड़बड़ लगे तो" }}
          hiClass="text-orange-600"
        />
      </h3>
      <dl className="mt-3 space-y-3">
        {chapter.recap.faqs.map((f, i) => (
          <div key={i} className="rounded-2xl bg-orange-50 p-4 dark:bg-stone-900">
            <dt className="font-bold">
              <Bilingual text={f.q} hiClass="text-orange-700" />
            </dt>
            <dd className="mt-1">
              <Bilingual text={f.a} hiClass="text-muted-foreground" />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
