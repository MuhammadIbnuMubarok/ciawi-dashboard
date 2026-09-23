/** @type {import('tailwindcss').Config} */
const inline = {darkMode:"class",theme:{extend:{colors:{"primary":"#4cd7f6","primary-container":"#06b6d4","on-primary-container":"#00424f","secondary":"#93ccff","secondary-container":"#3198dc","surface":"#0b1326","surface-container-lowest":"#060e20","surface-container-low":"#131b2e","surface-container":"#171f33","surface-container-high":"#222a3d","surface-card":"#111C44","on-surface":"#dae2fd","on-surface-variant":"#bcc9cd","outline-variant":"#3d494c","tertiary":"#ffb95f","tertiary-container":"#e79400","siaga-1":"#EF4444","siaga-2":"#F97316","siaga-3":"#FBBF24","siaga-4":"#38BDF8","siaga-normal":"#10B981"},fontFamily:{headline:["Space Grotesk","sans-serif"],mono:["JetBrains Mono","monospace"]}}}}
module.exports = {
  content: ["./index.html", "./*.js", "./js/*.js"],
  ...inline,
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
    ...(inline.plugins || []),
  ],
}
