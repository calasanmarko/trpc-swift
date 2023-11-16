import express from "express";
import { appRouter } from "./routes/router.js";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

export { appRouter };

const port = 5050;
const app = express();

app.use(
    "/trpc",
    createExpressMiddleware({
        router: appRouter,
        responseMeta: (opts) => {
            console.log(`${opts.paths?.join(".")} ->`, opts.data);
            return {};
        },
        onError: (opts) => {
            console.error(`${opts.path} -> ${opts.error.code} ${opts.error.message} ${opts.error.stack}`);
        },
        maxBodySize: undefined,
    })
);

app.listen(port, () => console.log(`Server running on port ${port}`));
