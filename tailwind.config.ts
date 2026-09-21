import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        marca: {
          50: "var(--marca-50)",
          100: "var(--marca-100)",
          500: "var(--marca-500)",
          600: "var(--marca-600)",
          700: "var(--marca-700)",
          900: "var(--marca-900)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
