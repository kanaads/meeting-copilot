import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sora)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      colors: {
        bg: "#0d0f12",
        surface: "#13151a",
        "surface-2": "#1a1d24",
        border: "#22252e",
        accent: "#2563eb",
        "accent-bright": "#3b82f6",
        "accent-glow": "rgba(37,99,235,0.08)",
        ink: "#e2e8f0",
        muted: "#6b7280",
        dim: "#374151",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-down": "slideDown 0.35s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
