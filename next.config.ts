import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.7.239"],
  experimental: {
    allowedDevOrigins: ["192.168.7.239"],
  },
};

export default nextConfig;
