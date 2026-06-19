import "./globals.css";
import { Nunito, Fredoka } from "next/font/google";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata = {
  title: "Pedalytics",
  description: "Persoonlijke AI-fietscoach",
  manifest: "/manifest.json",
  themeColor: "#F5F1EA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pedalytics",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl" className={`${nunito.variable} ${fredoka.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pedalytics" />
        <meta name="theme-color" content="#F5F1EA" />
      </head>
      <body>{children}</body>
    </html>
  );
}
