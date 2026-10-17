import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { AppError } from "../../shared/app-error.js";
import { isIP } from "node:net";

export function isPublicImageAddress(address: string): boolean {
    if (!isIP(address)) return false;
    if (address.includes(":")) {
        // Only global unicast; excludes mapped IPv4, loopback, local and documentation addresses.
        return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address);
    }
    const [a, b, c] = address.split(".").map(Number);
    return (
        a !== undefined &&
        b !== undefined &&
        c !== undefined &&
        a > 0 &&
        a < 224 &&
        a !== 10 &&
        a !== 127 &&
        !(a === 100 && b >= 64 && b <= 127) &&
        !(a === 169 && b === 254) &&
        !(a === 172 && b >= 16 && b <= 31) &&
        !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) &&
        !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) &&
        !(a === 203 && b === 0 && c === 113)
    );
}

// Developer CLI only. Pin a validated DNS address for each HTTPS redirect to avoid DNS rebinding.
export async function downloadLibraryImage(input: string, redirects = 0): Promise<Buffer> {
    const url = new URL(input);
    if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443") ||
        redirects > 3
    ) {
        throw new AppError(400, "Use a public HTTPS image URL without credentials", "INVALID_IMAGE_URL");
    }
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some((item) => !isPublicImageAddress(item.address))) {
        throw new AppError(400, "Private or reserved image addresses are not allowed", "INVALID_IMAGE_URL");
    }
    const address = addresses[0]!;
    return new Promise<Buffer>((resolve, reject) => {
        const request = get(
            url,
            {
                family: address.family,
                lookup: (_host, _options, callback) => callback(null, address.address, address.family)
            },
            (response) => {
                response.on("error", reject);
                if (
                    response.statusCode &&
                    [301, 302, 303, 307, 308].includes(response.statusCode) &&
                    response.headers.location
                ) {
                    response.resume();
                    void downloadLibraryImage(new URL(response.headers.location, url).href, redirects + 1).then(
                        resolve,
                        reject
                    );
                    return;
                }
                if (
                    response.statusCode !== 200 ||
                    !/^image\/(jpeg|png|webp|gif|avif|heic|heif)(?:;|$)/i.test(response.headers["content-type"] ?? "")
                ) {
                    response.resume();
                    reject(
                        new AppError(
                            400,
                            "The link must return a supported raster image, not a web page",
                            "INVALID_IMAGE_URL"
                        )
                    );
                    return;
                }
                const chunks: Buffer[] = [];
                let size = 0;
                response.on("data", (chunk: Buffer) => {
                    size += chunk.length;
                    if (size > 10000000) {
                        response.destroy(new Error("Image exceeds 10 MB"));
                        return;
                    }
                    chunks.push(chunk);
                });
                response.on("end", () => (size ? resolve(Buffer.concat(chunks)) : reject(new Error("Image is empty"))));
                response.on("error", reject);
            }
        );
        const deadline = setTimeout(() => request.destroy(new Error("Image download timed out")), 15000);
        request.on("close", () => clearTimeout(deadline));
        request.on("error", reject);
    });
}
