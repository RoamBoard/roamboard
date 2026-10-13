export function sessionCookieName(): string {
    return process.env.NODE_ENV === "production"
        ? "__Host-roamboard_session"
        : "roamboard_session";
}

export function readSessionCookie(header: string | undefined): string | null {
    const prefix = `${sessionCookieName()}=`;
    const entry = header
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix));
    return entry ? entry.slice(prefix.length) : null;
}
