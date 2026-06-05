import { T } from "@/components/localized-text";
import { PageHero } from "@/components/page-hero";

const rules = [
  ["01", "rules.oneTitle", "rules.oneBody"],
  ["02", "rules.twoTitle", "rules.twoBody"],
  ["03", "rules.threeTitle", "rules.threeBody"],
  ["04", "rules.fourTitle", "rules.fourBody"],
] as const;

export default function RulesPage() {
  return (
    <>
      <PageHero eyebrow="rules.eyebrow" title="rules.title" lead="rules.lead" />
      <section className="card-grid section">
        {rules.map(([number, title, body]) => (
          <article className="content-card" key={number}>
            <span className="step-number">{number}</span>
            <h2><T id={title} /></h2>
            <p><T id={body} /></p>
          </article>
        ))}
      </section>
    </>
  );
}
