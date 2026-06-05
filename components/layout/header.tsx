import Link from "next/link";
import { T } from "@/components/localized-text";
import { PreferenceControls } from "@/components/preferences/preference-controls";

const links = [
  { href: "/", label: "nav.home" },
  { href: "/draft", label: "nav.draft" },
  { href: "/result", label: "nav.result" },
  { href: "/rules", label: "nav.rules" },
  { href: "/about", label: "nav.about" },
] as const;

export function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark">30.0</span>
          <span className="brand-text"><T id="common.brand" /></span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              <T id={link.label} />
            </Link>
          ))}
        </nav>
        <PreferenceControls />
      </div>
    </header>
  );
}
