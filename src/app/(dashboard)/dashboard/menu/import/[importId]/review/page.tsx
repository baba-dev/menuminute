import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { importDetail } from "@/modules/menu-import/service";
import { initialReviewDocument } from "@/modules/menu-import/review";
import { parseImportCandidate } from "@/modules/menu-import/contracts";
import { ReviewWorkspace } from "./review-workspace";
type C = { params: Promise<{ importId: string }> };
export default async function ReviewPage({ params }: C) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet)
    return (
      <div className="panel">
        <h1>Select an outlet</h1>
        <Link href="/onboarding">Set up your outlet</Link>
      </div>
    );
  const detail = await importDetail(
    { userId: session.user.id },
    outlet.id,
    (await params).importId
  );
  if (!detail.candidate)
    return (
      <div className="space-y-4 rounded-3xl border border-stone-200 bg-white p-8">
        <h1 className="text-2xl font-bold">No extraction to review yet</h1>
        <p className="text-sm text-stone-600">
          Capture and process a source before opening human review.
        </p>
        <Link href="/dashboard/menu/import" className="font-semibold text-orange-700 underline">
          Return to capture
        </Link>
      </div>
    );
  const candidate = parseImportCandidate(detail.candidate.document);
  return (
    <ReviewWorkspace
      key={detail.id}
      outletId={outlet.id}
      importId={detail.id}
      initial={JSON.parse(JSON.stringify(detail))}
      candidate={candidate}
      initialDocument={
        detail.review ? initialReviewDocument(candidate) : initialReviewDocument(candidate)
      }
    />
  );
}
