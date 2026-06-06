import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MetadataSync } from "@/components/metadata-sync";
import { siteDescriptions } from "@/lib/page-metadata";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["cyrillic", "latin"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["cyrillic", "latin"],
});

const metadataBase = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);

export const metadata: Metadata = {
  metadataBase,
  title: "30-0: Ukrainian League",
  description: siteDescriptions.en,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["uk_UA"],
    title: "30-0: Ukrainian League",
    description: siteDescriptions.en,
    images: [
      {
        url: "/og-image.png",
        alt: "30-0: Ukrainian League",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "30-0: Ukrainian League",
    description: siteDescriptions.en,
    images: ["/og-image.png"],
  },
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
        <MetadataSync />
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
        <Analytics />
      </body>
    </html>
  );
}
