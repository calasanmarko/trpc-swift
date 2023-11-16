import { publicProcedure, router } from "../lib/trpc.js";
import { z } from "zod";

const depthRouter = router({
    three: publicProcedure
        .input(
            z.object({
                name: z.string().optional(),
                other: z
                    .object({
                        nest: z.number(),
                        bro: z.object({}),
                        arr: z.array(z.string().nullable()),
                        arr2: z.array(z.string().nullable()).optional(),
                    })
                    .array(),
            })
        )
        .output(
            z.object({
                message: z.string(),
            })
        )
        .query((opts) => {
            return {
                message: `Depth ${opts.input.other[0].nest}!`,
            };
        }),
    four: publicProcedure
        .input(
            z.object({
                name: z.string().optional(),
            })
        )
        .output(
            z
                .object({
                    message: z.string(),
                })
                .optional()
        )
        .query((opts) => {
            const name = opts.input.name ?? "depth";
            return {
                message: `Four ${name}!`,
            };
        }),
});

const nestedRouter = router({
    depth: depthRouter,
    nested: publicProcedure
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
            const name = opts.input.name ?? "bested";
            return {
                message: `Nested ${name}!`,
            };
        }),
});

export const appRouter = router({
    layer: nestedRouter,
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
