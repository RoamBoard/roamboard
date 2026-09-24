import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roamboard API Playground",
  description: "Small experiments for Roamboard's external APIs",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
