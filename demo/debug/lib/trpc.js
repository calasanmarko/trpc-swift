"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicProcedure = exports.middleware = exports.router = void 0;
const server_1 = require("@trpc/server");
const t = server_1.initTRPC.create();
exports.router = t.router;
exports.middleware = t.middleware;
exports.publicProcedure = t.procedure;
//# sourceMappingURL=trpc.js.map