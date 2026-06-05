import { translations, type TranslationKey } from "@/lib/translations";

export function T({ id }: { id: TranslationKey }) {
  return (
    <>
      <span className="localized-text" data-language="en">
        {translations.en[id]}
      </span>
      <span className="localized-text" data-language="ua">
        {translations.ua[id]}
      </span>
    </>
  );
}
