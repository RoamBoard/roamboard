import { Router } from "express";

import type { QuotaService } from "./quota.service.js";

export function createQuotaRouter(service: QuotaService): Router {
    const router = Router();
    router.get("/", async (_req, res) => res.json({ data: await service.status() }));
    return router;
}
