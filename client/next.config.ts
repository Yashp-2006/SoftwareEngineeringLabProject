import type { NextConfig } from "next";
import { config } from "dotenv";
import { join } from "path";

// Load environment variables from the root workspace
config({ path: join(process.cwd(), '../.env') });
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    externalDir: true,
  },

};

export default nextConfig;
