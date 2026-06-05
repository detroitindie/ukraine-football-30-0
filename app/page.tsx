import Link from "next/link";
import { T } from "@/components/localized-text";

const steps = [
  { number: "01", title: "home.stepDraftTitle", body: "home.stepDraftBody" },
  { number: "02", title: "home.stepSeasonTitle", body: "home.stepSeasonBody" },
  { number: "03", title: "home.stepResultTitle", body: "home.stepResultBody" },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="hero section">
        <div className="hero-copy">
          <p className="eyebrow"><T id="home.eyebrow" /></p>
          <h1><T id="home.title" /></h1>
          <p className="hero-lead"><T id="home.lead" /></p>
          <div className="button-row">
            <Link className="button button-primary" href="/draft">
              <T id="home.start" />
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-secondary" href="/rules">
              <T id="home.rules" />
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-ball">30</div>
          <div className="hero-score">
            <span>UA</span>
            <strong>3:0</strong>
            <span>SIM</span>
          </div>
          <div className="hero-stripes" />
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow"><T id="home.howEyebrow" /></p>
          <h2><T id="home.howTitle" /></h2>
        </div>
        <div className="step-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3><T id={step.title} /></h3>
              <p><T id={step.body} /></p>
            </article>
          ))}
        </div>
      </section>

      <section className="section cta-panel">
        <div>
          <p className="eyebrow"><T id="home.ctaEyebrow" /></p>
          <h2><T id="home.ctaTitle" /></h2>
        </div>
        <Link className="button button-light" href="/draft">
          <T id="home.ctaButton" />
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </>
  );
}
