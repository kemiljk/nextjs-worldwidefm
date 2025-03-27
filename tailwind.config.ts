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
          50: "#f2dfd9",
          100: "#e6c3b8",
          200: "#daa796",
          300: "#ce8b75",
          400: "#c36f53",
          500: "#ac583c",
          600: "#8a4731",
          700: "#693625",
          800: "#472419",
          900: "#261308",
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
          100: "#c6d0d8",
          200: "#ABBBC6",
          300: "#90a5b3",
          400: "#758fa1",
          500: "#5e788a",
          600: "#4c616f",
          700: "#394954",
          800: "#273138",
          900: "#15191e",
        },
        green: {
          50: "#e4e8e3",
          100: "#cdd4c9",
          200: "#B5C0B0",
          300: "#9dac97",
          400: "#86987d",
          500: "#6f8267",
          600: "#586853",
          700: "#41503f",
          800: "#2e362b",
          900: "#181c17",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
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
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
