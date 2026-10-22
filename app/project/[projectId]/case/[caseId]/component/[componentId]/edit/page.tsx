import { redirect } from "next/navigation";

/**
 * Old full-page "edit component" route (FLOW-8).
 *
 * Nothing in the app links here any more: steps are edited in the case
 * editor's inspector. The page it replaced fetched without the auth header
 * (always 401), read fields the API does not return, and on submit reset the
 * step's quantity to 1 and unit to "unit". A bookmarked or shared URL now
 * lands in the case editor with that step selected instead.
 */
export default async function EditComponentPage({
  params,
}: {
  params: Promise<{ projectId: string; caseId: string; componentId: string }>;
}) {
  const { projectId, caseId, componentId } = await params;
  redirect(
    `/project/${encodeURIComponent(projectId)}/case/${encodeURIComponent(caseId)}?componentId=${encodeURIComponent(componentId)}`,
  );
}
