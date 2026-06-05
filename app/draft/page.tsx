import { DraftGame } from "@/components/draft/draft-game";
import type { DraftMode } from "@/lib/draft-types";

type DraftPageProps = {
  searchParams: Promise<{ mode?: string | string[] }>;
};

export default async function DraftPage({ searchParams }: DraftPageProps) {
  const params = await searchParams;
  const requestedMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode: DraftMode = requestedMode === "hardcore" ? "hardcore" : "normal";

  return <DraftGame mode={mode} />;
}
