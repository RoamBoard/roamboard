export interface AppUser {
    userId: string;
    username: string;
    displayName: string;
}

export interface GoogleIdentity {
    sub: string;
    givenName: string;
    familyName: string;
}

export interface GoogleVerifier {
    verify(idToken: string): Promise<GoogleIdentity>;
}

export interface AuthRepository {
    findUserById(userId: string): Promise<AppUser | null>;
    createUser(user: AppUser): Promise<AppUser | null>;
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
