import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import Script from "next/script";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["cyrillic", "latin"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["cyrillic", "latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Ukraine Football 30.0",
    template: "%s | Ukraine Football 30.0",
  },
  description: "Build a Ukrainian football squad and explore a season simulation.",
};

const preferenceScript = `
  try {
    var theme = localStorage.getItem("uf30-theme");
    var language = localStorage.getItem("uf30-language");
    document.documentElement.dataset.theme =
      theme === "dark" || theme === "light"
        ? theme
        : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.language = language === "ua" ? "ua" : "en";
    document.documentElement.lang = language === "ua" ? "uk" : "en";
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${manrope.variable} ${unbounded.variable}`}
      data-language="en"
      data-theme="light"
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <Script
          id="preference-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: preferenceScript }}
        />
        <div className="site-shell">
          <Header />
          <main className="site-main">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
