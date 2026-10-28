/** Colors taken from the original web CSS (Common.css / auth.css / home.css) */
module.exports = {
  content: ["./App.js", "./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#05070b",
        surface: "#0a1018",
        surface2: "#0e141c",
        surface3: "#111c29",
        line: "#17212c",
        ink: "#e8edf5",
        soft: "#a7b1bf",
        muted: "#7f8b9b",
        faint: "#626e7e",
        brand: "#247cff",
        brandLight: "#72b0ff",
        authBg: "#080d1b",
        authSurface: "#10182b",
        danger: "#ff7185",
        success: "#43d9a3",
        pink: "#ed80dc",
        couple: "#70b8ad",
      },
    },
  },
  plugins: [],
};
