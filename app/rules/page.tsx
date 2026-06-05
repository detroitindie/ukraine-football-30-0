import { T } from "@/components/localized-text";
const rules = [
  ["01", "rules.oneTitle", "rules.oneBody"],
  ["02", "rules.twoTitle", "rules.twoBody"],
  ["03", "rules.threeTitle", "rules.threeBody"],
  ["04", "rules.fourTitle", "rules.fourBody"],
] as const;

export default function RulesPage() {
  return (
    <div className="compact-page">
      <header className="compact-heading">
        <p className="eyebrow"><T id="rules.eyebrow" /></p>
        <h1><T id="rules.title" /></h1>
        <p><T id="rules.lead" /></p>
      </header>
      <section className="card-grid compact-card-grid">
        {rules.map(([number, title, body]) => (
          <article className="content-card" key={number}>
            <span className="step-number">{number}</span>
            <h2><T id={title} /></h2>
            <p><T id={body} /></p>
          </article>
        ))}
      </section>
    </div>
  );
}
