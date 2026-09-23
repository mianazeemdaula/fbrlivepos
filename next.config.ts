import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hosts allowed to load /_next/* dev assets when running `next dev` (hostnames, not URLs).
  allowedDevOrigins: ["127.0.0.1", "localhost", "tax.aazify.com"],
  logging: {
    fetches: {
      fullUrl: true,
    }
  },
};

export default nextConfig;
