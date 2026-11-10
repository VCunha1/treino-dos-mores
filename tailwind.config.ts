import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#171717",
        surface: "#202020",
        card: "#272727",
        line: "#333333",
        brand: { DEFAULT: "#E5AE36", dark: "#B98625" },
        ink: { DEFAULT: "#F5F5F5", muted: "#A3A3A3" },
        success: "#4F9D6B",
        warn: "#D99A2B",
        danger: "#C8533F",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "14px", "2xl": "20px" },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { "fade-up": "fade-up .35s ease-out both" },
    },
  },
  plugins: [],
};

export default config;
