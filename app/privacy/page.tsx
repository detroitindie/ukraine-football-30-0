import { LegalPage } from "@/components/legal-page";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata("/privacy");

export default function PrivacyPage() {
  return <LegalPage prefix="privacy" />;
}
