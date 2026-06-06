import { T } from "@/components/localized-text";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata("/about");

const cards = [
  ["about.ideaTitle", "about.ideaBody"],
  ["about.milestoneTitle", "about.milestoneBody"],
  ["about.nextTitle", "about.nextBody"],
] as const;

export default function AboutPage() {
  return (
    <div className="compact-page">
      <header className="compact-heading">
        <h1><T id="about.title" /></h1>
      </header>
      <section className="card-grid compact-card-grid">
        {cards.map(([title, body]) => (
          <article className="content-card" key={title}>
            <h2><T id={title} /></h2>
            <p><T id={body} /></p>
          </article>
        ))}
      </section>
      <section className="about-contact">
        <h2><T id="about.contactTitle" /></h2>
        <p><T id="about.contactBody" /></p>
        <a href="mailto:30-0@ukr.net">30-0@ukr.net</a>
      </section>
    </div>
  );
}
