import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Velonx — District Health Intelligence",
  description:
    "A connected command centre for district healthcare. Synthetic hackathon demonstration.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
