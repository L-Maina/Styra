import type { Metadata, Viewport } from "next";
import { Syne, Manrope } from "next/font/google";
import "./globals.css";
import { t } from "@/core/copy";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ReducedMotionProvider } from "@/components/ui/reduced-motion-provider";
import { MotionSettings } from "@/components/theme/MotionSettings";
import { LaunchSplash } from "@/components/brand/LaunchSplash";
import { launchGuardScript } from "@/lib/launch";

// Identity kit type: Syne for display, Manrope for text and UI. Both are OFL fonts from Google Fonts.
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Styra · Your Style, On Demand.", template: "%s" },
  description: t("brand.metaDescription"),
  applicationName: "Styra",
  authors: [{ name: "Styra" }],
  creator: "Styra",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://styra-silk.vercel.app"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Styra · Your Style, On Demand.",
    description: t("brand.metaDescription"),
    type: "website",
    siteName: "Styra",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://styra-silk.vercel.app",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Styra: Your Style, On Demand." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Styra · Your Style, On Demand.",
    description: t("brand.metaDescription"),
    images: ["/og-image.png"],
  },
};

// Browser chrome follows the kit's ground colours: ivory for light, graphite for dark.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F0E8" },
    { media: "(prefers-color-scheme: dark)", color: "#121318" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Hides the launch splash before first paint when this session has already seen it. */}
        <script dangerouslySetInnerHTML={{ __html: launchGuardScript }} />
      </head>
      <body
        className={`${syne.variable} ${manrope.variable} font-sans antialiased bg-background text-foreground`}
      >
        <LaunchSplash />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ReducedMotionProvider>
            <MotionSettings>
              {children}
              <Toaster />
            </MotionSettings>
          </ReducedMotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
