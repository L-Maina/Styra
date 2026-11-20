import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ReducedMotionProvider } from "@/components/ui/reduced-motion-provider";
import { MotionSettings } from "@/components/theme/MotionSettings";
import { LaunchSplash } from "@/components/brand/LaunchSplash";
import { launchGuardScript } from "@/lib/launch";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Styra - Global Grooming Marketplace",
  description:
    "Discover and book premium grooming services near you. Connect with top barbers, salons, spas, and beauty professionals on the Styra marketplace.",
  keywords: [
    "Styra",
    "grooming",
    "barbershop",
    "salon",
    "spa",
    "beauty",
    "booking",
    "marketplace",
    "on-demand",
    "haircut",
  ],
  authors: [{ name: "Styra" }],
  creator: "Styra",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://styra-silk.vercel.app"
  ),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.png", type: "image/png", sizes: "256x256" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Styra - Global Grooming Marketplace",
    description:
      "Discover and book premium grooming services near you. Barbers, salons, spas — all on one platform.",
    type: "website",
    siteName: "Styra",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://styra-silk.vercel.app",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Styra: Your Style, On Demand" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Styra - Global Grooming Marketplace",
    description:
      "Discover and book premium grooming services near you.",
    images: ["/og-image.png"],
  },
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
        className={`${poppins.variable} ${inter.variable} font-sans antialiased bg-background text-foreground`}
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
