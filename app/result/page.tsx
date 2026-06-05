import { T } from "@/components/localized-text";
import { PageHero } from "@/components/page-hero";

const stats = [
  ["result.played", "30"],
  ["result.won", "17"],
  ["result.drawn", "7"],
  ["result.lost", "6"],
] as const;

const standings = [
  ["1", "FC Dynamo", "68", "W W D W W"],
  ["2", "FC Shakhtar", "65", "W D W W L"],
  ["3", "result.placeholderClub", "58", "W W L D W"],
  ["4", "FC Polissya", "54", "D W W L W"],
  ["5", "FC Kryvbas", "49", "L W D W D"],
] as const;

export default function ResultPage() {
  return (
    <>
      <PageHero
        eyebrow="result.eyebrow"
        title="result.title"
        lead="result.lead"
      />
      <section className="result-hero-card">
        <div>
          <p className="eyebrow"><T id="result.finish" /></p>
          <h2><T id="result.finishBody" /></h2>
          <p>17W · 7D · 6L · 58 PTS</p>
        </div>
        <div className="result-position">3<sup>rd</sup></div>
      </section>
      <section className="stats-grid">
        {stats.map(([label, value]) => (
          <article className="stat-card" key={label}>
            <span><T id={label} /></span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="table-card">
        <h2><T id="result.table" /></h2>
        <table className="standings">
          <thead>
            <tr>
              <th>#</th>
              <th><T id="result.club" /></th>
              <th><T id="result.form" /></th>
              <th><T id="result.points" /></th>
            </tr>
          </thead>
          <tbody>
            {standings.map(([place, club, points, form]) => (
              <tr className={place === "3" ? "highlight" : undefined} key={place}>
                <td>{place}</td>
                <td>{club === "result.placeholderClub" ? <T id={club} /> : club}</td>
                <td>{form}</td>
                <td>{points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
