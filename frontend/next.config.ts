import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
    reactCompiler: true,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "images.unsplash.com"
            }
        ]
    },
    // The tag catalog is shared with the rest of the repository.
    turbopack: { root: path.join(__dirname, "..") }
};

export default nextConfig;
