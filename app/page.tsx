import Image from "next/image";
import Link from "next/link";
import { T } from "@/components/localized-text";

export default function HomePage() {
  return (
    <section className="hero home-hero">
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
      <div className="hero-visual">
        <Image
          alt="Vintage Ukrainian football match"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 42vw"
          src="/images/hero-vintage-football.jpg"
        />
      </div>
    </section>
  );
}
