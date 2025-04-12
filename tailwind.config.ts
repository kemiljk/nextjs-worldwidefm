import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "*.{js,ts,jsx,tsx,mdx}"],
  prefix: "",
  theme: {
    fontFamily: {
      sans: ["var(--font-sans)", "system-ui", "sans-serif"],
    },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Custom colors
        brand: {
          orange: "hsl(var(--brand-orange))",
          beige: "hsl(var(--brand-beige))",
          blue: {
            DEFAULT: "hsl(var(--brand-blue))",
            dark: "hsl(var(--brand-blue-dark))",
            light: "hsl(var(--brand-blue-light))",
          },
        },
        // Figma color variables
        gray: {
          50: "#e4e7e7",
          100: "#cdd1d1",
          200: "#b5baba",
          300: "#9ea5a5",
          400: "#8690a0",
          500: "#6f7979",
          600: "#5a6161",
          700: "#444a4a",
          800: "#2e3232",
          900: "#181b1b",
        },
        crimson: {
          50: "#f9d8d2",
          100: "#f3b3a9",
          200: "#ef9f96",
          300: "#ea6b59",
          400: "#e54a30",
          500: "#cf331a",
          600: "#a62815",
          700: "#7e1e10",
          800: "#56140b",
          900: "#2d0a06",
        },
        bronze: {
          50: "#f9ead2",
          100: "#f3d7a9",
          200: "#efc396",
          300: "#eab259",
          400: "#e59f30",
          500: "#cf881a",
          600: "#a66e15",
          700: "#7e5310",
          800: "#56380b",
          900: "#2d1e06",
        },
        tan: {
          50: "#EAE6E0",
          100: "#d7d0c7",
          200: "#c4baad",
          300: "#b1a492",
          400: "#9e8e78",
          500: "#877761",
          600: "#6d604e",
          700: "#52473b",
          800: "#383128",
          900: "#1e1a15",
        },
        sky: {
          50: "#e1e6ea",
          100: "#c3d0d8",
          200: "#a5bbc6",
          300: "#87a5b3",
          400: "#698fa1",
          500: "#4f788a",
          600: "#3f616f",
          700: "#2f4954",
          800: "#1f3138",
          900: "#0f191e",
        },
        green: {
          50: "#e4e8e3",
          100: "#c8d4c3",
          200: "#acc0a3",
          300: "#90ac83",
          400: "#749863",
          500: "#5d8247",
          600: "#4a6837",
          700: "#374e27",
          800: "#243417",
          900: "#121a07",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tight: "-0.02em",
        wide: "0.02em",
      },
      borderRadius: {
        none: "0px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
      },
      keyframes: {
        "marquee-move-text": {
          from: {
            transform: "translateX(0)",
          },
          to: {
            transform: "translateX(-100%)",
          },
        },
      },
      animation: {
        "marquee-move": "marquee-move-text var(--speed, 15s) linear infinite var(--direction, forwards)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

export default config;
