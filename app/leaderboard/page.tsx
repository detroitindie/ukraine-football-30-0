import { LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { T } from "@/components/localized-text";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata("/leaderboard");

export default function LeaderboardPage() {
  return (
    <div className="compact-page leaderboard-page">
      <header className="compact-heading">
        <h1><T id="leaderboard.pageTitle" /></h1>
        <p><T id="leaderboard.pageLead" /></p>
      </header>
      <LeaderboardBoard />
    </div>
  );
}
