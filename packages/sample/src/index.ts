import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router";
import express from "express";

const app = express();
app.use(
    "/trpc",
    createExpressMiddleware({
        router: appRouter,
        createContext: (opts) => {
            console.log(opts.req.url);
            return {};
        },
        onError(opts) {
            console.error(`${opts.path} -> ${opts.error.code} ${opts.error.message} ${opts.error.stack}`);
        },
    })
);

app.listen(3000);
console.log("Listening on http://localhost:3000/trpc");
