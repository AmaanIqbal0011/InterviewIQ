import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { Suspense } from "react";
import { siteConfig } from "@/lib/siteConfig";
import { landingContentService } from "@/services/LandingContentService";
import { Providers } from "@/components/layout/Providers";
import { AppChrome } from "@/components/layout/AppChrome";
import { SessionNavbar } from "@/components/layout/SessionNavbar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const { brand, description, url } = siteConfig;
const pageTitle = `${brand.name} — ${brand.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: {
    default: pageTitle,
    template: `%s | ${brand.name}`,
  },
  description,
  keywords: [...siteConfig.keywords],
  openGraph: {
    type: "website",
    locale: "en_US",
    url,
    siteName: brand.name,
    title: pageTitle,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const navLinks = landingContentService
    .getNavLinks()
    .map((link) => ({ label: link.label, href: link.href }));

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${sora.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement;r.classList.add("dark");try{if(localStorage.getItem("theme")==="light"){r.classList.remove("dark");r.classList.add("light");r.style.colorScheme="light"}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <Suspense fallback={<main id="main-content" className="flex-1" />}>
            <AppChrome navbar={<SessionNavbar links={navLinks} />}>
              {children}
            </AppChrome>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
