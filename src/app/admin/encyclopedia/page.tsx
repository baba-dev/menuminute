import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, Plus, ArrowRight, Search, LockKeyhole } from "lucide-react";
import { verifySuperAdmin } from "@/lib/admin-guard";
import { listEditorialEntries } from "@/modules/food-encyclopedia/editorial-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Food Encyclopedia | Editorial Studio",
  robots: { index: false, follow: false },
};
export default async function EditorialDashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const actor = await verifySuperAdmin();
  const p = await searchParams;
  let entries: Awaited<ReturnType<typeof listEditorialEntries>> = [];
  let available = true;
  try {
    entries = await listEditorialEntries(actor, p.q ?? "", p.status ?? "");
  } catch {
    available = false;
  }
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-bold tracking-[0.2em] text-orange-600 uppercase dark:text-orange-300">
            The Atlas / Editorial control
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Food Encyclopedia Studio
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            Research, review and publish immutable food guides. No recipe or AI suggestion is
            automatically indexable.
          </p>
        </div>
        <Link
          href="/admin/encyclopedia/import"
          className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold dark:border-stone-700"
        >
          Catalogue queue
        </Link>
        <Link
          href="/admin/encyclopedia/new"
          className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700"
        >
          <Plus size={18} />
          New guide
        </Link>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Drafts", entries.filter((x) => x.status === "draft").length],
          ["Awaiting review", entries.filter((x) => x.status === "in_review").length],
          ["Published", entries.filter((x) => x.hasPublishedVersion).length],
        ].map(([label, count]) => (
          <div
            key={label}
            className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
          >
            <p className="text-xs tracking-widest text-stone-500 uppercase">{label}</p>
            <p className="mt-2 text-3xl font-bold">{count}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-100">
        <div className="flex items-center gap-2 font-semibold">
          <LockKeyhole size={18} />
          Protected publishing
        </div>
        <p className="mt-2">
          Changes require a verified administrative step-up. Authors cannot approve their own
          revisions. Review at least two credible sources and any artwork licenses before
          publishing.
        </p>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3" role="search">
        <label
          className="flex min-w-52 flex-1 flex-col gap-1 text-sm font-medium"
          htmlFor="food-editorial-search"
        >
          Search guide title or slug
          <input
            id="food-editorial-search"
            name="q"
            maxLength={100}
            defaultValue={p.q ?? ""}
            className="rounded-xl border border-stone-300 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-950"
            placeholder="Find a guide"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="food-editorial-status">
          Status
          <select
            id="food-editorial-status"
            name="status"
            defaultValue={p.status ?? ""}
            className="rounded-xl border border-stone-300 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-950"
          >
            {["", "draft", "in_review", "approved", "published", "archived"].map((value) => (
              <option key={value} value={value}>
                {value || "All stages"}
              </option>
            ))}
          </select>
        </label>
        <button className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-white dark:bg-stone-700">
          <Search size={17} />
          Filter
        </button>
      </form>
      {!available ? (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950"
        >
          Editorial database is not installed or currently unavailable. Public menu operations are
          unaffected; an operator must review migration 0117 after migration 0115/0116.
        </p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-12 text-center dark:border-stone-700">
          <BookOpenText size={38} className="mx-auto mb-3 text-orange-600" />
          <h2 className="font-display text-2xl font-bold">The library starts here.</h2>
          <p className="my-3 text-sm text-stone-500">
            Create the first researched draft or import a catalogue candidate for review.
          </p>
          <Link
            className="text-orange-700 underline dark:text-orange-300"
            href="/admin/encyclopedia/new"
          >
            Create a draft
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <table className="w-full min-w-[660px] text-left text-sm">
            <thead className="bg-stone-50 text-xs tracking-wide text-stone-500 uppercase dark:bg-stone-950">
              <tr>
                {["Guide", "Type", "Stage", "Version", "Published", "Action"].map((h) => (
                  <th key={h} className="p-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-stone-200 dark:border-stone-800">
                  <td className="p-4">
                    <strong>{e.title}</strong>
                    <div className="text-xs text-stone-500">/{e.slug}</div>
                  </td>
                  <td className="p-4 capitalize">{e.kind}</td>
                  <td className="p-4">{e.status.replace("_", " ")}</td>
                  <td className="p-4 font-mono">{e.version}</td>
                  <td className="p-4">{e.hasPublishedVersion ? "Yes" : "No"}</td>
                  <td className="p-4">
                    <Link
                      className="inline-flex items-center gap-2 font-bold text-orange-700 dark:text-orange-300"
                      href={"/admin/encyclopedia/" + e.id}
                    >
                      Open <ArrowRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
