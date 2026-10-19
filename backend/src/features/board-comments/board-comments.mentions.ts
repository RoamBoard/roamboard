const mentionPattern = /(^|[^A-Za-z0-9._])@([A-Za-z0-9](?:[A-Za-z0-9._]{0,62}[A-Za-z0-9])?)(?![A-Za-z0-9._])/g;
export const maxCommentMentions = 10;

export function mentionHandles(body: string): string[] {
    const handles = new Set<string>();
    for (const match of body.matchAll(mentionPattern)) handles.add(match[2]!.toLowerCase());
    return [...handles];
}
