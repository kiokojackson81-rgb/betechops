/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx,tsx}',
    './**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'betech-orange': '#F59E0B',
        'betech-maroon': '#7f1d1d',
        'betech-warmcharcoal': '#1c1917',
      },
    },
  },
  plugins: [],
};
