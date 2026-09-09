import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calify — Weight",
  description: "A minimal weight-history tracker",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
