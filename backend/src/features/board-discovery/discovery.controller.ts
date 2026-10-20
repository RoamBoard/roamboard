import type { RequestHandler } from "express";
import type { createDiscoveryService } from "./discovery.service.js";
import type { CollectionContext, DiscoveryQuery, DiscoveryRepository } from "./discovery.types.js";

export const browserCookieName = () =>
    process.env.NODE_ENV === "production" ? "__Host-roamboard_browser" : "roamboard_browser";
export function readBrowserCookie(header?: string): string | null {
    const value = header
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${browserCookieName()}=`))
        ?.slice(browserCookieName().length + 1);
    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
type Controller = Record<
    "collection" | "search" | "suggestions" | "recent" | "mine" | "saved" | "featured" | "view",
    RequestHandler
>;
export function createDiscoveryController(
    service: ReturnType<typeof createDiscoveryService>,
    repository: DiscoveryRepository
): Controller {
    const user = (locals: Record<string, unknown>) => (locals.user as { userId: string } | null)?.userId ?? null;
    return {
        collection: async (_request, response) =>
            response.json({
                data: await service.collection(
                    user(response.locals),
                    response.locals.params.context as CollectionContext,
                    response.locals.query
                )
            }),
        search: async (_request, response) =>
            response.json({ data: await service.search(user(response.locals), response.locals.query) }),
        suggestions: async (_request, response) =>
            response.json({
                data: await service.search(user(response.locals), {
                    ...(response.locals.query as DiscoveryQuery),
                    page: 1,
                    limit: Math.min(4, response.locals.query.limit)
                })
            }),
        recent: async (_request, response) => {
            const { page, limit } = response.locals.query;
            response.json({ data: await service.list(user(response.locals), "discovery", page, limit) });
        },
        mine: async (_request, response) => {
            const { page, limit } = response.locals.query;
            response.json({ data: await service.list(user(response.locals), "mine", page, limit) });
        },
        saved: async (_request, response) => {
            const { page, limit } = response.locals.query;
            response.json({ data: await service.list(user(response.locals), "saved", page, limit) });
        },
        featured: async (_request, response) =>
            response.json({ data: await service.featured(user(response.locals), response.locals.query.period) }),
        view: async (request, response) => {
            const userId = user(response.locals);
            const browserId = await repository.browser(readBrowserCookie(request.headers.cookie), userId);
            if (userId) await repository.mergeBrowser(browserId, userId);
            response.cookie(browserCookieName(), browserId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 30 * 86400000
            });
            response.json({
                data: await service.view(response.locals.params.boardId, userId, browserId, request.body.token)
            });
        }
    };
}
