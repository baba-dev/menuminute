import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Full-page status surface for "not found" and "something went wrong". Styled with the shared
 * semantic tokens only, so it is correct in Light and Dark without any page-specific stylesheet.
 */
export function StatusPage({
  eyebrow,
  title,
  description,
  children,
  role,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** Actions: links or buttons using the shared `mm-action` classes. */
  children: ReactNode;
  role?: "alert";
}) {
  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center justify-center px-4 py-12">
      <section
        role={role}
        aria-labelledby="status-page-title"
        className="bg-card border-border w-full max-w-md rounded-3xl border p-8 text-center shadow-[var(--shadow-floating)] sm:p-10"
      >
        <Image
          src="/brand/icons/favicon.svg"
          alt=""
          width={56}
          height={56}
          unoptimized
          className="mx-auto mb-6 rounded-2xl"
        />
        <p className="text-primary mb-3 text-xs font-bold tracking-[0.18em] uppercase">{eyebrow}</p>
        <h1 id="status-page-title" className="text-3xl leading-tight font-bold text-balance">
          {title}
        </h1>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty">
          {description}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">{children}</div>
      </section>
    </main>
  );
}
