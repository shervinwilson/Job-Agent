import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { paper: "#F5F6F2", ink: "#1D2B30", pine: "#0E6B63", mist: "#DDE3DE", amber: "#B7791F", brick: "#B23A2E" },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
