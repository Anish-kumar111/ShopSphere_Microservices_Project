import { Router, type Router as RouterType } from "express";

export const router: RouterType = Router();

// Feature routers go in this folder and are mounted here, e.g. router.use("/orders", ordersRouter).
// TODO Ch 8: GET /products, GET /products/:id, GET /products?ids=
// TODO Ch 8: POST /orders (idempotency + outbox), GET /orders, GET /orders/:id
// TODO Ch 8: POST /orders/:id/cancel, /orders/:id/pay; admin product + ship endpoints
