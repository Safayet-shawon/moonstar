import type { NextFunction, Request, RequestHandler, Response } from "express";
import { errorResponse } from "./lib/server";

/** Async-safe route wrapper: converts thrown errors to JSON responses. */
export const route =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((e) => {
      const { status, body } = errorResponse(e);
      if (!res.headersSent) res.status(status).json(body);
      else next(e);
    });
  };

export const ip = (req: Request) => (req.ip ?? req.socket.remoteAddress ?? "unknown").replace(/^::ffff:/, "");
