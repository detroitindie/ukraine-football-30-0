"use client";

function setLanguage(language: "en" | "ua") {
  document.documentElement.dataset.language = language;
  document.documentElement.lang = language === "ua" ? "uk" : "en";
  localStorage.setItem("uf30-language", language);
}

function toggleTheme() {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("uf30-theme", nextTheme);
}

export function PreferenceControls() {
  return (
    <div className="preferences">
      <div
        className="language-switch"
        role="group"
        aria-label={translationsLabel()}
      >
        <button
          className="language-button"
          data-language-option="ua"
          type="button"
          onClick={() => setLanguage("ua")}
        >
          UA
        </button>
        <button
          className="language-button"
          data-language-option="en"
          type="button"
          onClick={() => setLanguage("en")}
        >
          EN
        </button>
      </div>
      <button
        className="theme-button"
        type="button"
        onClick={toggleTheme}
        aria-label={themeLabel()}
      >
        <svg className="sun-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <svg className="moon-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 15.2A8.5 8.5 0 018.8 4a8.5 8.5 0 1011.2 11.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function translationsLabel() {
  return "Language / Мова";
}

function themeLabel() {
  return "Switch day or night theme / Перемкнути денну або нічну тему";
}
