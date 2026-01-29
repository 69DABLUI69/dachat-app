/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Generates static HTML/JS/CSS files
  images: {
    unoptimized: true, // Required as mobile doesn't have a Next.js server
  },
};

module.exports = nextConfig;