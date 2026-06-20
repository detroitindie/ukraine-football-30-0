import Image from "next/image";
import Link from "next/link";
import { HomeStart } from "@/components/home/home-start";
import { LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { T } from "@/components/localized-text";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata("/");

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero home-hero">
        <div className="hero-copy">
          <h1><T id="home.title" /></h1>
          <p className="hero-lead"><T id="home.lead" /></p>
          <HomeStart />
          <div className="button-row home-secondary-row">
            <Link className="button button-secondary" href="/rules">
              <T id="home.rules" />
            </Link>
          </div>
          <a
            className="support-link"
            href="https://donatello.to/mkornieiev"
            rel="noopener noreferrer"
            target="_blank"
          >
            <T id="home.support" />
            <span aria-hidden="true">↗</span>
          </a>
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
      <LeaderboardBoard compact />
    </div>
  );
}
