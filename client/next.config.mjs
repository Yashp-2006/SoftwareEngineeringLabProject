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
  },
};

export default nextConfig;
