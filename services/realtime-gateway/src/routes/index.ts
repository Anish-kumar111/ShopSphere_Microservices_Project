import { Router, type Router as RouterType } from "express";

export const router: RouterType = Router();

// Feature routers go in this folder and are mounted here, e.g. router.use("/orders", ordersRouter).
// TODO Ch 15: attach Socket.IO to the server returned by startHttpService (path /ws, Redis adapter)
