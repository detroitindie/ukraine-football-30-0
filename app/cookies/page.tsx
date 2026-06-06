import { LegalPage } from "@/components/legal-page";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata("/cookies");

export default function CookiesPage() {
  return <LegalPage prefix="cookies" />;
}
