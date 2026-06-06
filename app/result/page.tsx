import { SeasonResultView } from "@/components/result/season-result";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata("/result");

export default function ResultPage() {
  return <SeasonResultView />;
}
