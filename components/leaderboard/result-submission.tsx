"use client";

import { type FormEvent, useMemo, useState } from "react";
import { LEADERBOARD_UPDATED_EVENT } from "@/components/leaderboard/leaderboard-board";
import { T } from "@/components/localized-text";
import {
  isValidNickname,
  resultFingerprint,
  sanitizeNickname,
} from "@/lib/leaderboard";
import type { SavedSeason } from "@/lib/seasonSimulation";

const SUBMISSION_KEY_PREFIX = "uf30-leaderboard-submitted:";

export function ResultSubmission({ season }: { season: SavedSeason }) {
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "invalid" | "error" | "skipped"
  >("idle");
  const fingerprint = useMemo(
    () => resultFingerprint({
      mode: season.mode,
      lineup: season.lineup,
      result: season.result,
    }),
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
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: cleanNickname,
          mode: season.mode,
          lineup: season.lineup,
          result: season.result,
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
        <span className="eyebrow"><T id="leaderboard.optional" /></span>
        <h2><T id="leaderboard.submitPrompt" /></h2>
        <p><T id="leaderboard.submitBody" /></p>
      </div>

      {status === "success" ? (
        <p className="leaderboard-submit-message is-success" role="status">
          <T id="leaderboard.submitSuccess" />
        </p>
      ) : (
        <form onSubmit={submitResult}>
          <label htmlFor="leaderboard-nickname">
            <T id="leaderboard.nicknameField" />
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
              <T id={status === "submitting"
                ? "leaderboard.submitting"
                : "leaderboard.submit"} />
            </button>
            <button
              className="button button-secondary"
              disabled={status === "submitting"}
              onClick={() => setStatus("skipped")}
              type="button"
            >
              <T id="leaderboard.skip" />
            </button>
          </div>
          {status === "invalid" && (
            <p className="leaderboard-submit-message is-error" role="alert">
              <T id="leaderboard.invalidNickname" />
            </p>
          )}
          {status === "error" && (
            <p className="leaderboard-submit-message is-error" role="alert">
              <T id="leaderboard.submitError" />
            </p>
          )}
        </form>
      )}
    </section>
  );
}
