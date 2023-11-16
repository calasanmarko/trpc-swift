import { publicProcedure, router } from "../lib/trpc.js";
import { z } from "zod";
z.ZodType.prototype.swift = function (metadata) {
    this._def.swift = metadata;
    return this;
};
const bigObj = z
    .object({
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
    .swift({
    name: "BigObj",
    description: "A big object",
});
const depthRouter = router({
    three: publicProcedure
        .input(bigObj)
        .output(z
        .object({
        message: z.string(),
    })
        .array())
        .query((opts) => {
        return [
            {
                message: `Depth ${opts.input.other[0].nest}!`,
            },
            {
                message: `Depth ${opts.input.other[0].arr2?.[0]}!`,
            },
        ];
    }),
    four: publicProcedure
        .input(z.object({
        name: z.string().optional(),
    }))
        .output(z
        .object({
        message: z.string(),
    })
        .optional())
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
        .input(z.object({
        name: z.string().optional(),
    }))
        .output(z.object({
        message: z.string(),
    }))
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
        .input(z.object({
        name: z.string().optional(),
    }))
        .output(z.object({
        message: z.string(),
    }))
        .query((opts) => {
        const name = opts.input.name ?? "World";
        return {
            message: `Hello ${name}!`,
        };
    }),
});
//# sourceMappingURL=router.js.map