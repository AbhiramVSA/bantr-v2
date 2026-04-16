/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "on-tertiary-fixed-variant": "#710549",
        "inverse-on-surface": "#00a6ef",
        tertiary: "#9e316d",
        "secondary-fixed-dim": "#b2e600",
        "surface-container-low": "#e6f2ff",
        "surface-tint": "#004be3",
        "outline-variant": "#36b7ff",
        "on-secondary-fixed-variant": "#4c6400",
        "surface-variant": "#bee1ff",
        "surface-container": "#d5ebff",
        "primary-fixed-dim": "#6c8cff",
        "surface-bright": "#f1f7ff",
        "tertiary-dim": "#8f2461",
        "on-error": "#ffefef",
        outline: "#007eb6",
        "secondary-dim": "#425700",
        "on-primary": "#f2f1ff",
        "on-background": "#00324b",
        "on-error-container": "#510017",
        "error-dim": "#a70138",
        "surface-container-lowest": "#ffffff",
        "surface-container-highest": "#bee1ff",
        "tertiary-fixed": "#ff8bc3",
        "secondary-container": "#bef500",
        background: "#f1f7ff",
        "on-secondary-container": "#435900",
        secondary: "#4c6400",
        "inverse-primary": "#6889ff",
        "tertiary-container": "#ff8bc3",
        "on-primary-fixed": "#000000",
        "tertiary-fixed-dim": "#f679b7",
        "on-surface-variant": "#00618e",
        "primary-container": "#819bff",
        primary: "#004be3",
        surface: "#f1f7ff",
        "inverse-surface": "#00101c",
        "on-primary-fixed-variant": "#002376",
        "on-primary-container": "#001b61",
        "surface-container-high": "#c9e6ff",
        "on-secondary": "#dfff8f",
        "on-secondary-fixed": "#344500",
        "primary-fixed": "#819bff",
        "on-tertiary-fixed": "#360021",
        "on-tertiary": "#ffeff3",
        "on-tertiary-container": "#63003f",
        "surface-dim": "#acdaff",
        "error-container": "#f74b6d",
        "primary-dim": "#0041c8",
        "secondary-fixed": "#bef500",
        "on-surface": "#00324b",
        error: "#b41340"
      },
      borderRadius: {
        DEFAULT: "1rem",
        lg: "2rem",
        xl: "3rem",
        full: "9999px"
      },
      fontFamily: {
        headline: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"]
      },
      boxShadow: {
        sticker: "0 12px 40px rgba(0, 50, 75, 0.06)"
      }
    }
  },
  plugins: []
};
