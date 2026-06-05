import { T } from "@/components/localized-text";
import type { TranslationKey } from "@/lib/translations";

type PageHeroProps = {
  eyebrow: TranslationKey;
  title: TranslationKey;
  lead: TranslationKey;
};

export function PageHero({ eyebrow, title, lead }: PageHeroProps) {
  return (
    <header className="page-hero">
      <p className="eyebrow"><T id={eyebrow} /></p>
      <h1><T id={title} /></h1>
      <p className="page-lead"><T id={lead} /></p>
    </header>
  );
}
