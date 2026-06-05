import { FormationBoard } from "@/components/formation/formation-board";
import { T } from "@/components/localized-text";

const summary = [
  ["draft.goalkeepersShort", "0/1"],
  ["draft.defendersShort", "0/4"],
  ["draft.midfieldersShort", "0/4"],
  ["draft.forwardsShort", "0/2"],
] as const;

const availablePlayers = [
  { name: "Player One", position: "GK", context: "FC Placeholder / 1990s", stats: "Apps 0 / CS 0" },
  { name: "Player Two", position: "DEF", context: "FC Placeholder / 2000s", stats: "Apps 0 / Goals 0" },
  { name: "Player Three", position: "MID", context: "FC Placeholder / 1980s", stats: "Apps 0 / Goals 0" },
  { name: "Player Four", position: "FW", context: "FC Placeholder / 2010s", stats: "Apps 0 / Goals 0" },
  { name: "Player Five", position: "MID", context: "FC Placeholder / 1990s", stats: "Apps 0 / Goals 0" },
] as const;

export default function DraftPage() {
  return (
    <div className="draft-workspace">
      <header className="draft-heading">
        <div>
          <p className="eyebrow"><T id="draft.eyebrow" /></p>
          <h1><T id="draft.title" /></h1>
        </div>
        <p><T id="draft.lead" /></p>
      </header>
      <div className="draft-layout">
        <aside className="draft-status-column">
          <div className="summary-card">
            <div className="summary-heading">
              <span><T id="draft.filled" /></span>
              <strong>0/11</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: "0%" }} />
            </div>
            <ul className="summary-list">
              {summary.map(([label, value]) => (
                <li key={label}>
                  <span><T id={label} /></span>
                  <strong>{value}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="draft-context">
            <div>
              <span><T id="draft.currentClub" /></span>
              <strong>FC Placeholder</strong>
            </div>
            <div>
              <span><T id="draft.currentDecade" /></span>
              <strong>1990-1999</strong>
            </div>
          </div>
          <p className="draft-note"><T id="draft.note" /></p>
        </aside>
        <FormationBoard />
        <aside className="available-panel">
          <div className="available-heading">
            <div>
              <span><T id="draft.available" /></span>
              <strong>5</strong>
            </div>
            <button className="compact-button" disabled type="button">
              <T id="draft.reroll" />
            </button>
          </div>
          <div className="available-list">
            {availablePlayers.map((player) => (
              <article className="available-player" key={player.name}>
                <span className="available-position">{player.position}</span>
                <div>
                  <strong>{player.name}</strong>
                  <span>{player.context}</span>
                  <small>{player.stats}</small>
                </div>
                <button disabled type="button" aria-label={`Select ${player.name}`}>+</button>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
