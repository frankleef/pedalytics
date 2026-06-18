import "./globals.css";

export const metadata = {
  title: "Fietscoach Frank",
  description: "Persoonlijke fietscoach met Strava-analyse en weekschema",
  manifest: "/manifest.json",
  themeColor: "#07111d",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fietscoach",
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
    <html lang="nl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Fietscoach" />
        <meta name="theme-color" content="#07111d" />
      </head>
      <body>{children}</body>
    </html>
  );
}
