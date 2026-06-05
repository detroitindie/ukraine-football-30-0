import { T } from "@/components/localized-text";
const stats = [
  ["result.record", "17-7-6"],
  ["result.pointsLong", "58"],
  ["result.goals", "52:31"],
  ["result.goalDifference", "+21"],
] as const;

export default function ResultPage() {
  return (
    <div className="compact-page result-page">
      <header className="compact-heading">
        <p className="eyebrow"><T id="result.eyebrow" /></p>
        <h1><T id="result.seasonResult" /></h1>
      </header>
      <section className="stats-grid">
        {stats.map(([label, value]) => (
          <article className="stat-card" key={label}>
            <span><T id={label} /></span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <p className="result-verdict"><T id="result.shortVerdict" /></p>
    </div>
  );
}
