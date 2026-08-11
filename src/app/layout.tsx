import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CampaignFlow Pro — Marketing Performance Intelligence",
    template: "%s | CampaignFlow Pro",
  },
  description:
    "Unify your marketing and sales data. Visualize funnel performance. Get AI-powered recommendations. Built for agency owners, consultants, and founders.",
  keywords: [
    "marketing analytics",
    "campaign performance",
    "funnel analysis",
    "AI recommendations",
    "marketing ROI",
    "agency reporting",
  ],
  authors: [{ name: "CampaignFlow Pro" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: "CampaignFlow Pro — Marketing Performance Intelligence",
    description:
      "Unify your marketing data, visualize funnel performance, and get AI-powered growth recommendations.",
    siteName: "CampaignFlow Pro",
  },
  twitter: {
    card: "summary_large_image",
    title: "CampaignFlow Pro",
    description: "AI-powered marketing performance intelligence platform",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#6470f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
