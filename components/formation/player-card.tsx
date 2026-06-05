import { T } from "@/components/localized-text";
import type { TranslationKey } from "@/lib/translations";

type PlayerCardProps = {
  number: number;
  position: TranslationKey;
};

export function PlayerCard({ number, position }: PlayerCardProps) {
  return (
    <div className="player-card">
      <span className="player-number">{number}</span>
      <strong><T id="draft.placeholder" /> {number}</strong>
      <span><T id={position} /></span>
    </div>
  );
}
