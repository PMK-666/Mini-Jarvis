import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#FAF8F4",
        paper: "#FFFFFF",
        ink: { DEFAULT: "#1B1A17", soft: "#4A4740", mute: "#8A857B" },
        line: "#ECE8E1",
        sand: "#F3EFE8",
        accent: { DEFAULT: "#B4532A", soft: "#F6E7DE" },
        ok: { DEFAULT: "#2F6B4F", soft: "#E3F0E8" },
        warn: { DEFAULT: "#9A6B12", soft: "#FBF1DC" },
        bad: { DEFAULT: "#A3362B", soft: "#F8E3E0" },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        display: ["New York", "ui-serif", "Iowan Old Style", "Charter", "Georgia", "serif"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        float: "0 1px 2px rgba(27,26,23,0.04), 0 8px 24px rgba(27,26,23,0.06)",
        bar: "0 -1px 0 rgba(27,26,23,0.06), 0 -8px 24px rgba(27,26,23,0.04)",
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "none" } },
        pulseDot: { "0%,100%": { opacity: "0.35" }, "50%": { opacity: "1" } },
      },
      animation: {
        rise: "rise 360ms cubic-bezier(.2,.7,.2,1) both",
        pulseDot: "pulseDot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
