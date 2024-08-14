import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";

Bun.serve({
    fetch: async (req) =>
        fetchRequestHandler({
            router: appRouter,
            endpoint: "/trpc",
            req,
            createContext: (opts) => {
                console.log(opts.req.url);
                return {};
            },
            onError(opts) {
                console.error(`${opts.path} -> ${opts.error.code} ${opts.error.message} ${opts.error.stack}`);
            },
        }),
});
