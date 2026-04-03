import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ReducedMotionProvider } from "@/components/ui/reduced-motion-provider";

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
    process.env.NEXT_PUBLIC_APP_URL || "https://styra.app"
  ),
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Styra - Global Grooming Marketplace",
    description:
      "Discover and book premium grooming services near you. Barbers, salons, spas — all on one platform.",
    type: "website",
    siteName: "Styra",
  },
  twitter: {
    card: "summary_large_image",
    title: "Styra - Global Grooming Marketplace",
    description:
      "Discover and book premium grooming services near you.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ReducedMotionProvider>
            {children}
            <Toaster />
          </ReducedMotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
