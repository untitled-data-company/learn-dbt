import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learn dbt",
  description: "Interactive dbt learning platform with DuckDB-WASM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}