"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const trpc_js_1 = require("../lib/trpc.js");
const zod_1 = require("zod");
exports.appRouter = (0, trpc_js_1.router)({
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