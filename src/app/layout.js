import "./globals.css";
import { Public_Sans } from "next/font/google";

const publicSansText = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

const publicSansNum = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata = {
  title: "Pedalytics",
  description: "Persoonlijke AI-fietscoach",
  manifest: "/manifest.json",
  themeColor: "#FAF9F6",
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
    <html lang="nl" className={`${publicSansText.variable} ${publicSansNum.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pedalytics" />
        <meta name="theme-color" content="#FAF9F6" />
      </head>
      <body>{children}</body>
    </html>
  );
}
