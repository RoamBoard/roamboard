import type { Metadata } from "next";
import localFont from "next/font/local";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

// Both typefaces are from Fontshare (fontshare.com). Download the variable
// .woff2 files and place them in src/fonts/.
const cabinet = localFont({
  src: "../fonts/CabinetGrotesk-Variable.woff2",
  variable: "--font-cabinet",
  weight: "100 800",
  display: "swap",
});

const satoshi = localFont({
  src: "../fonts/Satoshi-Variable.woff2",
  variable: "--font-satoshi",
  weight: "300 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Roamboard",
  description:
    "Roamboard is a visual travel platform for discovering places, finding inspiration, and turning the things you love into journeys of your own.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${cabinet.variable} ${satoshi.variable} antialiased`}>
        {children}
        <footer className="px-6 py-3 text-12 text-graphite">Location data: <a href="https://www.geoapify.com/">Powered by Geoapify</a> &middot; <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a></footer>
      </body>
    </html>
  );
}
