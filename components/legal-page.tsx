import { T } from "@/components/localized-text";
import { PageHero } from "@/components/page-hero";
import type { TranslationKey } from "@/lib/translations";

type LegalPageProps = {
  prefix: "privacy" | "cookies";
};

export function LegalPage({ prefix }: LegalPageProps) {
  const key = (suffix: string) => `${prefix}.${suffix}` as TranslationKey;

  return (
    <>
      <PageHero
        eyebrow={key("eyebrow")}
        title={key("title")}
        lead={key("lead")}
      />
      <div className="legal-layout">
        <aside className="legal-aside">
          <strong><T id="legal.contents" /></strong>
          <T id={key("updated")} />
        </aside>
        <article className="legal-content">
          {[1, 2, 3].map((section) => {
            const word = ["One", "Two", "Three"][section - 1];
            return (
              <section key={section}>
                <h2><T id={key(`section${word}Title`)} /></h2>
                <p><T id={key(`section${word}Body`)} /></p>
              </section>
            );
          })}
        </article>
      </div>
    </>
  );
}
