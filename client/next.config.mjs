process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = 'true';
import { config } from "dotenv";
import { join } from "path";

// Load environment variables from the root workspace
config({ path: join(process.cwd(), '../.env') });
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    externalDir: true,
  },
  serverExternalPackages: ['firebase-admin', 'jose', 'jwks-rsa'],
};


export default nextConfig;
