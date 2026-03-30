/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {

      /* ✅ FONT CONFIGURATION */
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        hand: ["Caveat", "cursive"],
      },

      /* ✅ COLORS (your existing system preserved) */
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        accent: "hsl(var(--accent))",

        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },

        /* 🔥 Optional: Human Mode palette (recommended) */
        human: {
          bg: "#fdf9f0",
          text: "#44403c",
          primary: "#d97706", // amber-600
          secondary: "#f59e0b", // amber-500
        },
      },

      /* ✅ ANIMATIONS (for Human Mode feel) */
      animation: {
        wobble: "wobble 6s ease-in-out infinite",
      },

      keyframes: {
        wobble: {
          "0%, 100%": { transform: "rotate(-1.5deg)" },
          "50%": { transform: "rotate(1.5deg)" },
        },
      },

      /* ✅ SHADOWS (soft organic look) */
      boxShadow: {
        human: "0 10px 25px rgba(245, 158, 11, 0.15)",
      },

      /* ✅ BORDER RADIUS (organic feel) */
      borderRadius: {
        human: "2rem",
        "human-lg": "3rem",
      },

    },
  },

  plugins: [],
};