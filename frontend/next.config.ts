import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
    output: "standalone",
    reactCompiler: true,
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "res.cloudinary.com" },
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
