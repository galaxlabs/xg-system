/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // CSS variable tokens
        bg:      "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        card:    "hsl(var(--card) / <alpha-value>)",
        text:    "hsl(var(--text) / <alpha-value>)",
        muted:   "hsl(var(--muted) / <alpha-value>)",
        primary: "hsl(var(--primary) / <alpha-value>)",
        accent:  "hsl(var(--accent) / <alpha-value>)",
        border:  "hsl(var(--border) / <alpha-value>)",
        sidebar: "hsl(var(--sidebar) / <alpha-value>)",
        // Semantic status
        success: "#10b981",
        warning: "#f59e0b",
        danger:  "#ef4444",
        info:    "#0ea5e9",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft:   "0 4px 20px -4px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.08)",
        glow:   "0 0 24px rgba(99,102,241,0.35)",
        "card": "0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)",
      },
      borderRadius: {
        panel: "var(--radius)",
        xl2:   "1.25rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
