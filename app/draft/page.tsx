import { FormationBoard } from "@/components/formation/formation-board";
import { T } from "@/components/localized-text";
import { PageHero } from "@/components/page-hero";

const summary = [
  ["draft.goalkeepers", "1 / 1"],
  ["draft.defenders", "4 / 4"],
  ["draft.midfielders", "4 / 4"],
  ["draft.forwards", "2 / 2"],
] as const;

export default function DraftPage() {
  return (
    <>
      <PageHero
        eyebrow="draft.eyebrow"
        title="draft.title"
        lead="draft.lead"
      />
      <div className="draft-layout">
        <FormationBoard />
        <aside className="draft-sidebar">
          <div className="summary-card">
            <h2><T id="draft.summary" /></h2>
            <ul className="summary-list">
              {summary.map(([label, value]) => (
                <li key={label}>
                  <span><T id={label} /></span>
                  <strong>{value}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="placeholder-note">
            <T id="draft.note" />
          </div>
        </aside>
      </div>
    </>
  );
}
