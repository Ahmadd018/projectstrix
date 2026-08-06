import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable the instrumentation.ts hook to start embedded scheduler on server boot
  instrumentationHook: true,
  allowedDevOrigins: [
    "13.60.36.215",
    "*.amazonaws.com",
  ],
};

export default nextConfig;
