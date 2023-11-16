import { publicProcedure, router } from "../lib/trpc.js";
import { ZodTypeAny, z } from "zod";

type ZodSwiftMetadata = {
    name?: string;
    description?: string;
};

declare module "zod" {
    interface ZodTypeDef {
        swift?: ZodSwiftMetadata;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ZodType<Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output> {
        swift<T extends ZodTypeAny>(this: T, metadata: ZodSwiftMetadata): T;
    }
}

z.ZodType.prototype.swift = function (metadata: ZodSwiftMetadata) {
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
        .output(
            z
                .object({
                    message: z.string(),
                })
                .array()
        )
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
