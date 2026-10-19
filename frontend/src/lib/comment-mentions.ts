import type { BoardComment } from "./board-comments";

const mentionPattern = /(^|[^A-Za-z0-9._])@([A-Za-z0-9](?:[A-Za-z0-9._]{0,62}[A-Za-z0-9])?)(?![A-Za-z0-9._])/g;
export const commentMentionLimit = 10;

export function commentMentionCount(body: string): number {
    return new Set([...body.matchAll(mentionPattern)].map((match) => match[2]!.toLowerCase())).size;
}

export function activeCommentMention(body: string, cursor: number) {
    const before = body.slice(0, cursor);
    const match = /(^|[^A-Za-z0-9._])@([A-Za-z0-9._]*)$/.exec(before);
    if (!match || match[2]!.length > 64) return null;
    const following = /^[A-Za-z0-9._]*/.exec(body.slice(cursor))?.[0].length ?? 0;
    return { start: cursor - match[2]!.length - 1, end: cursor + following, query: match[2]! };
}

export function insertCommentMention(
    body: string,
    mention: NonNullable<ReturnType<typeof activeCommentMention>>,
    username: string
) {
    const suffix = body.slice(mention.end);
    const spacer = suffix.length === 0 || !/^\s/.test(suffix) ? " " : "";
    const value = `${body.slice(0, mention.start)}@${username}${spacer}${suffix}`;
    return { value, cursor: mention.start + username.length + 1 + (spacer ? spacer.length : 1) };
}

export function commentMentionParts(body: string, mentions: BoardComment["mentions"]) {
    const known = new Map(mentions.map((mention) => [mention.handle.toLowerCase(), mention.username]));
    const parts: { text: string; username?: string }[] = [];
    const position = { cursor: 0 };
    for (const match of body.matchAll(mentionPattern)) {
        const start = match.index + match[1]!.length;
        if (start > position.cursor) parts.push({ text: body.slice(position.cursor, start) });
        const text = `@${match[2]!}`;
        const username = known.get(match[2]!.toLowerCase());
        parts.push(username ? { text, username } : { text });
        position.cursor = start + text.length;
    }
    if (position.cursor < body.length) parts.push({ text: body.slice(position.cursor) });
    return parts;
}
