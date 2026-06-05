import { T } from "@/components/localized-text";
const cards = [
  ["about.ideaTitle", "about.ideaBody"],
  ["about.milestoneTitle", "about.milestoneBody"],
  ["about.nextTitle", "about.nextBody"],
] as const;

export default function AboutPage() {
  return (
    <div className="compact-page">
      <header className="compact-heading">
        <p className="eyebrow"><T id="about.eyebrow" /></p>
        <h1><T id="about.title" /></h1>
        <p><T id="about.lead" /></p>
      </header>
      <section className="card-grid compact-card-grid">
        {cards.map(([title, body]) => (
          <article className="content-card" key={title}>
            <h2><T id={title} /></h2>
            <p><T id={body} /></p>
          </article>
        ))}
      </section>
    </div>
  );
}
