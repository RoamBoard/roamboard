import { OAuth2Client } from "google-auth-library";

import { AppError } from "../../shared/app-error.js";
import type { GoogleVerifier } from "./auth.types.js";

export function createGoogleVerifier(): GoogleVerifier {
    const client = new OAuth2Client();

    return {
        async verify(idToken) {
            const audience = process.env.GOOGLE_CLIENT_ID;
            if (!audience) {
                throw new Error("GOOGLE_CLIENT_ID is not configured");
            }

            try {
                const ticket = await client.verifyIdToken({
                    idToken,
                    audience
                });
                const payload = ticket.getPayload();
                if (!payload?.sub) {
                    throw new Error("Missing Google subject");
                }

                return {
                    sub: payload.sub,
                    givenName:
                        payload.given_name ??
                        payload.name?.split(" ")[0] ??
                        "Traveler",
                    familyName: payload.family_name ?? ""
                };
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.includes("Failed to retrieve verification certificates")
                ) {
                    throw new AppError(
                        503,
                        "Google verification is temporarily unavailable",
                        "GOOGLE_VERIFICATION_UNAVAILABLE"
                    );
                }
                throw new AppError(
                    401,
                    "Invalid Google credential",
                    "INVALID_GOOGLE_CREDENTIAL"
                );
            }
        }
    };
}
