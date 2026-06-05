import Link from "next/link";
import { T } from "@/components/localized-text";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <Link className="brand" href="/">
            <span className="brand-mark">30.0</span>
            <span><T id="common.brand" /></span>
          </Link>
          <p className="footer-copy"><T id="footer.copy" /></p>
        </div>
        <nav className="footer-links" aria-label="Legal navigation">
          <Link href="/privacy"><T id="footer.privacy" /></Link>
          <Link href="/cookies"><T id="footer.cookies" /></Link>
          <Link href="/rules"><T id="footer.rules" /></Link>
        </nav>
      </div>
    </footer>
  );
}
