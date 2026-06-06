import { T } from "@/components/localized-text";
import type { TranslationKey } from "@/lib/translations";

type LegalPageProps = {
  prefix: "privacy" | "cookies";
};

const sections = {
  privacy: [
    { name: "One" },
    {
      name: "Two",
      items: ["sectionTwoItemOne", "sectionTwoItemTwo", "sectionTwoItemThree", "sectionTwoItemFour"],
      after: "sectionTwoAfter",
    },
    { name: "Three" },
    { name: "Four" },
    { name: "Five" },
    { name: "Six" },
    { name: "Seven", email: true },
  ],
  cookies: [
    {
      name: "One",
      items: ["sectionOneItemOne", "sectionOneItemTwo", "sectionOneItemThree", "sectionOneItemFour"],
      after: "sectionOneAfter",
    },
    { name: "Two" },
    { name: "Three" },
  ],
} as const;

export function LegalPage({ prefix }: LegalPageProps) {
  const key = (suffix: string) => `${prefix}.${suffix}` as TranslationKey;

  return (
    <div className="legal-page">
      <header className="legal-heading">
        <h1><T id={key("title")} /></h1>
        <p><T id={key("lead")} /></p>
      </header>
      <div className="legal-layout">
        <aside className="legal-aside">
          <T id={key("updated")} />
        </aside>
        <article className="legal-content">
          {sections[prefix].map((section) => (
            <section key={section.name}>
              <h2><T id={key(`section${section.name}Title`)} /></h2>
              <p><T id={key(`section${section.name}Body`)} /></p>
              {"items" in section && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}><T id={key(item)} /></li>
                  ))}
                </ul>
              )}
              {"after" in section && (
                <p><T id={key(section.after)} /></p>
              )}
              {"email" in section && (
                <a href="mailto:30-0@ukr.net">30-0@ukr.net</a>
              )}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
