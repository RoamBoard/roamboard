import type { ProviderAsset } from "../images/images.types.js";

export type GooglePhotoImporter = (url: string, previousStorageKey?: string) => Promise<ProviderAsset | null>;

export interface AppUser {
    userId: string;
    username: string;
    displayName: string;
    profilePictureUrl?: string | null;
}

export interface GoogleIdentity {
    sub: string;
    givenName: string;
    familyName: string;
    picture?: string;
}

export interface GoogleVerifier {
    verify(idToken: string): Promise<GoogleIdentity>;
}

export interface AuthRepository {
    findUserById(userId: string): Promise<AppUser | null>;
    findGooglePhotoStorageKey(userId: string): Promise<string | null>;
    createUser(user: AppUser): Promise<AppUser | null>;
    saveGoogleDefaults(
        userId: string,
        previousDefaultName: string,
        fullName: string,
        asset?: ProviderAsset,
        generatedUsernameBase?: string,
        previousPhotoStorageKey?: string
    ): Promise<void>;
    createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void>;
    findUserBySession(tokenHash: string): Promise<AppUser | null>;
    deleteSession(tokenHash: string): Promise<void>;
}

export interface AuthService {
    signIn(idToken: string): Promise<{
        user: AppUser;
        isNew: boolean;
        sessionToken: string;
        expiresAt: Date;
    }>;
    currentUser(sessionToken: string): Promise<AppUser | null>;
    signOut(sessionToken: string): Promise<void>;
}
