import { useSyncExternalStore } from "react";

export type Language = "en" | "ua";

function getCurrentLanguage(): Language {
  if (typeof document === "undefined") {
    return "en";
  }

  return document.documentElement.dataset.language === "ua" ? "ua" : "en";
}

function subscribeToLanguageChange(onStoreChange: () => void) {
  if (typeof document === "undefined") {
    return () => {};
  }

  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-language"],
  });

  return () => observer.disconnect();
}

export function useLanguage(): Language {
  return useSyncExternalStore(
    subscribeToLanguageChange,
    getCurrentLanguage,
    () => "en",
  );
}
