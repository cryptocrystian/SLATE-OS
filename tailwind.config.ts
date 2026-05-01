import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        bg: {
          page: "var(--color-bg-page)",
          shell: "var(--color-bg-shell)",
          surface: "var(--color-bg-surface)",
          elevated: "var(--color-bg-elevated)",
          panel: "var(--color-bg-panel)",
        },
        border: {
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          disabled: "var(--color-text-disabled)",
          inverse: "var(--color-text-inverse)",
        },
        brand: {
          primary: "var(--color-brand-primary)",
        },
        practice: {
          ai: "var(--color-practice-ai)",
          dev: "var(--color-practice-dev)",
          studio: "var(--color-practice-studio)",
        },
        status: {
          success: "var(--color-status-success)",
          warning: "var(--color-status-warning)",
          risk: "var(--color-status-risk)",
          critical: "var(--color-status-critical)",
          info: "var(--color-status-info)",
          neutral: "var(--color-status-neutral)",
        },
      },
      boxShadow: {
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
      },
      backgroundImage: {
        "grid-subtle":
          "linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)",
        "radial-glow":
          "radial-gradient(circle at 20% 0%, rgba(108,140,255,0.08), transparent 50%), radial-gradient(circle at 80% 100%, rgba(95,184,255,0.05), transparent 55%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-up": "fade-up 320ms ease-out both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
