import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_ICON_SRC, APP_NAME } from "./lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Panel web multitenant para nutricionistas y seguimiento de pacientes.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: APP_ICON_SRC,
    shortcut: APP_ICON_SRC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
