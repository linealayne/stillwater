import type { Metadata, Viewport } from "next";
import { Cormorant, Hanken_Grotesk, Dela_Gothic_One, Courier_Prime } from "next/font/google";
import "./globals.css";
import "./chapters.css";

const serif = Cormorant({ variable: "--font-serif", subsets: ["latin"], weight: ["300", "400", "500", "600"], style: ["normal", "italic"], display: "swap" });
const sans = Hanken_Grotesk({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const display = Dela_Gothic_One({ variable: "--font-display", subsets: ["latin"], weight: "400", display: "swap" });
const typed = Courier_Prime({ variable: "--font-typed", subsets: ["latin"], weight: ["400", "700"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://stillwater-layne.vercel.app"),
  title: "Stillwater. Building a calmer world.",
  description: "Still waters run deep. A design showcase by Layne at Linea.",
  openGraph: {
    title: "Stillwater. Building a calmer world.",
    description: "Still waters run deep. A design showcase by Layne at Linea.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#efede6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-mode="front" className={`${serif.variable} ${sans.variable} ${display.variable} ${typed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
