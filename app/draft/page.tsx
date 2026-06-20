import { DraftGame } from "@/components/draft/draft-game";
import type { DraftCompetition, DraftMode } from "@/lib/draft-types";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata("/draft");

type DraftPageProps = {
  searchParams: Promise<{
    competition?: string | string[];
    mode?: string | string[];
  }>;
};

export default async function DraftPage({ searchParams }: DraftPageProps) {
  const params = await searchParams;
  const requestedCompetition = Array.isArray(params.competition)
    ? params.competition[0]
    : params.competition;
  const requestedMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const competition: DraftCompetition =
    requestedCompetition === "cup" ? "cup" : "league";
  const mode: DraftMode = requestedMode === "hardcore" ? "hardcore" : "normal";

  return <DraftGame competition={competition} mode={mode} />;
}
