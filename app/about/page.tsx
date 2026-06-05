import { T } from "@/components/localized-text";
import { PageHero } from "@/components/page-hero";

const cards = [
  ["about.ideaTitle", "about.ideaBody"],
  ["about.milestoneTitle", "about.milestoneBody"],
  ["about.nextTitle", "about.nextBody"],
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="about.eyebrow" title="about.title" lead="about.lead" />
      <section className="card-grid section">
        {cards.map(([title, body]) => (
          <article className="content-card" key={title}>
            <h2><T id={title} /></h2>
            <p><T id={body} /></p>
          </article>
        ))}
      </section>
    </>
  );
}
