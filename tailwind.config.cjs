/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg:      "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        card:    "hsl(var(--card) / <alpha-value>)",
        text:    "hsl(var(--text) / <alpha-value>)",
        muted:   "hsl(var(--muted) / <alpha-value>)",
        primary: "hsl(var(--primary) / <alpha-value>)",
        accent:  "hsl(var(--accent) / <alpha-value>)",
        border:  "hsl(var(--border) / <alpha-value>)",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      borderRadius: { panel: "var(--radius)", lg2: "var(--radius-lg)" },
      boxShadow: {
        soft:  "0 4px 20px -4px rgba(0,0,0,0.10), 0 2px 8px -2px rgba(0,0,0,0.06)",
        card:  "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        glow:  "0 0 20px rgba(37,99,235,0.25)",
      },
      animation: {
        "fade-in":  "fadeIn 0.2s ease-out both",
        "slide-up": "slideUp 0.2s ease-out both",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        slideUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
    },
  },
  plugins: [],
};
