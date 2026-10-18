import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DistrictCare — District Healthcare Operations",
  description:
    "District healthcare operations: synthetic facility activity, pharmacy stock, reported capacity and data quality for coordination.",
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
