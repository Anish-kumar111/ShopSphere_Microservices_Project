import { Router, type Router as RouterType } from "express";

export const router: RouterType = Router();

// Feature routers go in this folder and are mounted here, e.g. router.use("/orders", ordersRouter).
// TODO Ch 5: POST /signup, /login, /refresh, /logout
// TODO Ch 5: GET /.well-known/jwks.json
// TODO Ch 5: POST /password/forgot, /password/reset
