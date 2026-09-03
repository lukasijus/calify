import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calify",
  description: "Local calorie and body tracker",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
