"use client";

import { type FormEvent, useMemo, useState } from "react";
import { LEADERBOARD_UPDATED_EVENT } from "@/components/leaderboard/leaderboard-board";
import {
  cupResultFingerprint,
  isValidNickname,
  resultFingerprint,
  sanitizeNickname,
} from "@/lib/leaderboard";
import { type Language } from "@/lib/language";
import { translations } from "@/lib/translations";
import type { SavedResult } from "@/lib/seasonSimulation";

const SUBMISSION_KEY_PREFIX = "uf30-leaderboard-submitted:";

export function ResultSubmission({
  season,
  language,
}: {
  season: SavedResult;
  language: Language;
}) {
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "invalid" | "error" | "skipped"
  >("idle");
  const fingerprint = useMemo(
    () => {
      if (season.competition === "cup" && season.result) {
        return cupResultFingerprint({
          competition: season.competition,
          mode: season.mode,
          lineup: season.lineup,
          result: season.result,
        });
      }

      if (season.competition === "league") {
        return resultFingerprint({
          competition: season.competition,
          mode: season.mode,
          lineup: season.lineup,
          result: season.result,
        });
      }

      return "";
    },
    [season],
  );
  const storageKey = `${SUBMISSION_KEY_PREFIX}${fingerprint}`;

  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanNickname = sanitizeNickname(nickname);
    if (!isValidNickname(cleanNickname)) {
      setStatus("invalid");
      return;
    }
    if (sessionStorage.getItem(storageKey)) {
      setStatus("success");
      return;
    }

    setStatus("submitting");
    try {
      const language =
        document.documentElement.dataset.language === "ua" ? "ua" : "en";
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition: season.competition,
          nickname: cleanNickname,
          mode: season.mode,
          lineup: season.lineup,
          result: season.result,
          language,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as {
          error?: string;
        } | null;
        if (response.status === 400 && data?.error === "Invalid nickname") {
          setStatus("invalid");
        } else {
          setStatus("error");
        }
        return;
      }
      sessionStorage.setItem(storageKey, "1");
      setNickname(cleanNickname);
      setStatus("success");
      window.dispatchEvent(new Event(LEADERBOARD_UPDATED_EVENT));
    } catch {
      setStatus("error");
    }
  }

  if (status === "skipped") {
    return null;
  }

  return (
    <section className="leaderboard-submit">
      <div>
        <span className="eyebrow">{translations[language]["leaderboard.optional"]}</span>
        <h2>{translations[language]["leaderboard.submitPrompt"]}</h2>
        <p>{translations[language]["leaderboard.submitBody"]}</p>
      </div>

      {status === "success" ? (
        <p className="leaderboard-submit-message is-success" role="status">
          {translations[language]["leaderboard.submitSuccess"]}
        </p>
      ) : (
        <form onSubmit={submitResult}>
          <label htmlFor="leaderboard-nickname">
            {translations[language]["leaderboard.nicknameField"]}
          </label>
          <div className="leaderboard-submit-row">
            <input
              autoComplete="nickname"
              id="leaderboard-nickname"
              maxLength={20}
              minLength={2}
              onChange={(event) => {
                setNickname(event.target.value);
                if (status === "invalid" || status === "error") {
                  setStatus("idle");
                }
              }}
              placeholder="2-20"
              type="text"
              value={nickname}
            />
            <button
              className="button button-primary"
              disabled={status === "submitting"}
              type="submit"
            >
              {translations[language][status === "submitting"
                ? "leaderboard.submitting"
                : "leaderboard.submit"]}
            </button>
            <button
              className="button button-secondary"
              disabled={status === "submitting"}
              onClick={() => setStatus("skipped")}
              type="button"
            >
              {translations[language]["leaderboard.skip"]}
            </button>
          </div>
          {status === "invalid" && (
            <p className="leaderboard-submit-message is-error" role="alert">
              {translations[language]["leaderboard.invalidNickname"]}
            </p>
          )}
          {status === "error" && (
            <p className="leaderboard-submit-message is-error" role="alert">
              {translations[language]["leaderboard.submitError"]}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
