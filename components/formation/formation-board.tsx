import { T } from "@/components/localized-text";
import { PlayerCard } from "@/components/formation/player-card";

const rows = [
  { position: "draft.position.fw", players: [9, 10] },
  { position: "draft.position.mf", players: [7, 8, 6, 11] },
  { position: "draft.position.df", players: [3, 4, 5, 2] },
  { position: "draft.position.gk", players: [1] },
] as const;

export function FormationBoard() {
  return (
    <section className="formation-shell">
      <div className="formation-toolbar">
        <div>
          <span className="formation-label"><T id="draft.formation" /></span>
          <strong className="formation-value">4-4-2</strong>
        </div>
        <div>
          <span className="formation-label"><T id="draft.status" /></span>
          <strong className="formation-value"><T id="draft.statusValue" /></strong>
        </div>
      </div>
      <div className="pitch">
        {rows.map((row) => (
          <div className="formation-row" key={row.position}>
            {row.players.map((number) => (
              <PlayerCard
                key={number}
                number={number}
                position={row.position}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
