"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const trpc_js_1 = require("../lib/trpc.js");
const zod_1 = require("zod");
const depthRouter = (0, trpc_js_1.router)({
    three: trpc_js_1.publicProcedure
        .input(zod_1.z.object({
        name: zod_1.z.string().optional(),
    }))
        .output(zod_1.z.object({
        message: zod_1.z.string(),
    }))
        .query((opts) => {
        const name = opts.input.name ?? "depth";
        return {
            message: `Depth ${name}!`,
        };
    }),
    four: trpc_js_1.publicProcedure
        .input(zod_1.z.object({
        name: zod_1.z.string().optional(),
    }))
        .output(zod_1.z.object({
        message: zod_1.z.string(),
    }))
        .query((opts) => {
        const name = opts.input.name ?? "depth";
        return {
            message: `Four ${name}!`,
        };
    }),
});
const nestedRouter = (0, trpc_js_1.router)({
    depth: depthRouter,
    nested: trpc_js_1.publicProcedure
        .input(zod_1.z.object({
        name: zod_1.z.string().optional(),
    }))
        .output(zod_1.z.object({
        message: zod_1.z.string(),
    }))
        .query((opts) => {
        const name = opts.input.name ?? "bested";
        return {
            message: `Nested ${name}!`,
        };
    }),
});
exports.appRouter = (0, trpc_js_1.router)({
    layer: nestedRouter,
    hello: trpc_js_1.publicProcedure
        .input(zod_1.z.object({
        name: zod_1.z.string().optional(),
    }))
        .output(zod_1.z.object({
        message: zod_1.z.string(),
    }))
        .query((opts) => {
        const name = opts.input.name ?? "World";
        return {
            message: `Hello ${name}!`,
        };
    }),
});
//# sourceMappingURL=router.js.map