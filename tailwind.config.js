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
        // status tokens for admin UI
        'status-complete': '#10B981',
        'status-partial': '#F59E0B',
        'status-missing': '#EF4444',
        'status-muted': '#334155',
      },
    },
  },
  plugins: [],
};
