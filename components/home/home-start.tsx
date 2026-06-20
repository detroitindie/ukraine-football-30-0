"use client";

import Link from "next/link";
import { useState } from "react";
import { T } from "@/components/localized-text";
import type { TranslationKey } from "@/lib/translations";
import type { DraftCompetition, DraftMode } from "@/lib/draft-types";

const competitions: DraftCompetition[] = ["league", "cup"];
const modes: DraftMode[] = ["normal", "hardcore"];

function competitionLabel(competition: DraftCompetition): TranslationKey {
  return competition === "cup" ? "home.competitionCup" : "home.competitionLeague";
}

function modeLabel(mode: DraftMode): TranslationKey {
  return mode === "hardcore" ? "home.difficultyHardcore" : "home.difficultyNormal";
}

export function HomeStart() {
  const [competition, setCompetition] = useState<DraftCompetition | null>(null);

  return (
    <div className="home-start">
      <div className="home-choice-group" role="group" aria-label="Competition">
        {competitions.map((option) => (
          <button
            className={`home-choice${competition === option ? " is-active" : ""}`}
            key={option}
            type="button"
            onClick={() => setCompetition(option)}
          >
            <span><T id={competitionLabel(option)} /></span>
            {option === "cup" && <span className="new-badge">NEW</span>}
          </button>
        ))}
      </div>

      {competition && (
        <div className="home-choice-group home-mode-group" role="group" aria-label="Difficulty">
          {modes.map((mode) => (
            <Link
              className={`button ${mode === "hardcore" ? "button-hardcore" : "button-primary"}`}
              href={`/draft?competition=${competition}&mode=${mode}`}
              key={mode}
            >
              <T id={modeLabel(mode)} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
