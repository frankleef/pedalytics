"use client";
import { useEffect, useRef } from "react";

export default function Turnstile({ onVerify }) {
  const ref = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || !ref.current) return;

    function render() {
      if (widgetId.current != null || !window.turnstile) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token) => onVerify?.(token),
        "expired-callback": () => onVerify?.(null),
        theme: "light",
      });
    }

    if (window.turnstile) {
      render();
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetId.current != null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [onVerify]);

  return <div ref={ref} style={{ marginBottom: 16 }} />;
}
