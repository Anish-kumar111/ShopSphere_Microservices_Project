import { Router, type Router as RouterType } from "express";

export const router: RouterType = Router();

// Feature routers go in this folder and are mounted here, e.g. router.use("/orders", ordersRouter).
// TODO Ch 6: auth routes that set cookies (/auth/login, /auth/refresh, /auth/logout)
// TODO Ch 6: GraphQL Yoga at /api/graphql (app.use(yoga.graphqlEndpoint, yoga))
// TODO Ch 6: /me/dashboard (Promise.allSettled + timeouts)
