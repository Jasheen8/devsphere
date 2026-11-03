import type { Request, Response } from "express";

export function createReadinessHandler(query: () => Promise<unknown>) {
  return async (_req: Request, res: Response) => {
    try {
      await query();
      return res.json({ ready: true, database: "ready" });
    } catch {
      return res.status(503).json({ ready: false, database: "unavailable" });
    }
  };
}
