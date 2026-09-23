import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server is opened via 127.0.0.1 as well as localhost; allow it to load /_next/* assets.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  logging: {
    fetches: {
      fullUrl: true,
    }
  },
};

export default nextConfig;
