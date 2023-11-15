import { publicProcedure, router } from "../lib/trpc.js";
import { z } from "zod";

export const appRouter = router({
    hello: publicProcedure
        .input(
            z.object({
                name: z.string().optional(),
            })
        )
        .output(
            z.object({
                message: z.string(),
            })
        )
        .query((opts) => {
            const name = opts.input.name ?? "World";
            return {
                message: `Hello ${name}!`,
            };
        }),
});
