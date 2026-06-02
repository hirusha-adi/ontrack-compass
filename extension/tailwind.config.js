/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dashboard/**/*.{html,js}", "./lib/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto", "system-ui", "sans-serif"],
        mono: ["Roboto Mono", "ui-monospace", "monospace"],
      },
      colors: {
        md: {
          primary: "#1976d2",
          "primary-dark": "#1565c0",
          "primary-light": "#42a5f5",
          surface: "#ffffff",
          background: "#f5f5f5",
          divider: "#e0e0e0",
          "text-primary": "rgba(0, 0, 0, 0.87)",
          "text-secondary": "rgba(0, 0, 0, 0.6)",
          "text-disabled": "rgba(0, 0, 0, 0.38)",
          error: "#d32f2f",
          warning: "#ed6c02",
          success: "#2e7d32",
        },
      },
      boxShadow: {
        "elevation-1":
          "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
        "elevation-2":
          "0 2px 4px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.2)",
        "elevation-appbar":
          "0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14)",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        compass: {
          primary: "#1976d2",
          "primary-content": "#ffffff",
          secondary: "#757575",
          "secondary-content": "#ffffff",
          accent: "#1976d2",
          neutral: "#424242",
          "base-100": "#ffffff",
          "base-200": "#f5f5f5",
          "base-300": "#eeeeee",
          "base-content": "rgba(0, 0, 0, 0.87)",
          info: "#0288d1",
          success: "#2e7d32",
          warning: "#ed6c02",
          error: "#d32f2f",
        },
      },
    ],
  },
};
