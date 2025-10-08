/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#1E40AF', // A deep, professional blue
        'brand-secondary': '#3B82F6', // A lighter, accessible blue for accents
        'status-ok': '#16A34A',      // Green for items in good standing
        'status-near-expiry': '#F97316', // Orange for warning
        'status-expired': '#DC2626',   // Red for expired items
        'base-100': '#F8FAFC', // Very light gray for backgrounds
        'base-200': '#E2E8F0', // Light gray for borders and dividers
        'base-300': '#94A3B8', // Medium gray for text
      },
    },
  },
  plugins: [],
}