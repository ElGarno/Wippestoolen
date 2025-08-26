import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,
  
  // Security headers configuration
  async headers() {
    const isDev = process.env.NODE_ENV === 'development'
    
    // Content Security Policy
    const cspHeader = `
      default-src 'self';
      script-src 'self' ${isDev ? "'unsafe-eval' 'unsafe-inline'" : "'unsafe-inline'"};
      style-src 'self' 'unsafe-inline' fonts.googleapis.com;
      img-src 'self' blob: data: https:;
      font-src 'self' fonts.gstatic.com;
      connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'} ${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8002'};
      media-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim()

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  
  // Image optimization configuration
  images: {
    domains: ['localhost'], // Add your image domains here
    formats: ['image/webp', 'image/avif'],
  },
  
  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;