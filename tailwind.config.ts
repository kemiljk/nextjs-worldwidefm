import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}","./components/**/*.{ts,tsx}","./app/**/*.{ts,tsx}","./src/**/*.{ts,tsx}","*.{js,ts,jsx,tsxmdx}","./cosmic/**/*.{ts,tsx,js,jsx}"],
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
          950: "#000000",
        },
        crimson: {
          50: "#FEF5EE",
          100: "#FDE7D7",
          200: "#FBCBAD",
          300: "#F8A779",
          400: "#F47843",
          500: "#F0551F",
          600: "#E83D15",
          700: "#BB2A13",
          800: "#952417",
          900: "#782016",
          950: "#410C09",
        },
        bronze: {
          50: "#FEFBE8",
          100: "#FDF5C4",
          200: "#FCE78C",
          300: "#FAD44A",
          400: "#F6BD19",
          500: "#E6A40C",
          600: "#C67E08",
          700: "#9E590A",
          800: "#834610",
          900: "#6F3A14",
          950: "#411D07",
        },
        cornflower: {
          50: "#F0F6FD",
          100: "#E3EFFC",
          200: "#CCE0F9",
          300: "#ADCAF4",
          400: "#8CACED",
          500: "#7793E5",
          600: "#556CD6",
          700: "#4659BC",
          800: "#3B4C98",
          900: "#364479",
          950: "#1F2547",
        },
        sky: {
          50: "#E9F9FF",
          100: "#CEF2FF",
          200: "#A7EAFF",
          300: "#6BE0FF",
          400: "#26CAFF",
          500: "#00A4FF",
          600: "#007AFF",
          700: "#005FFF",
          800: "#0051E6",
          900: "#004AB3",
          950: "#00367E",
        },
        green: {
          50: "#F6F8F5",
          100: "#EBF1E7",
          200: "#D9E2D0",
          300: "#ACC09B",
          400: "#92AA7E",
          500: "#718C5B",
          600: "#5B7148",
          700: "#485A3B",
          800: "#3C4932",
          900: "#323D2A",
          950: "#192013",
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
            transform: "translateX(-50%)",
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
