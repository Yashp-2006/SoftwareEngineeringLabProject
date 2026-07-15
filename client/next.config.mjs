process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = 'true';
import { config } from "dotenv";
import { join } from "path";

// Load environment variables from the root workspace
config({ path: join(process.cwd(), '../.env') });
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    externalDir: true,
    turbopack: {
      resolveConditions: ['node', 'require', 'default'],
      resolveAlias: {
        'jose': './node_modules/jose/dist/node/cjs/index.js',
      }
    }
  },
  serverExternalPackages: ['firebase-admin', 'jose', 'jwks-rsa'],
};


export default nextConfig;
