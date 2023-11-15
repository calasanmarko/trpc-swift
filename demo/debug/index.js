"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router_js_1 = require("./routes/router.js");
const express_2 = require("@trpc/server/adapters/express");
const port = 5050;
const app = (0, express_1.default)();
app.use("/trpc", (0, express_2.createExpressMiddleware)({
    router: router_js_1.appRouter,
    responseMeta: (opts) => {
        console.log(`${opts.paths?.join(".")} ->`, opts.data);
        return {};
    },
    onError: (opts) => {
        console.error(`${opts.path} -> ${opts.error.code} ${opts.error.message} ${opts.error.stack}`);
    },
    maxBodySize: undefined,
}));
app.listen(port, () => console.log(`Server running on port ${port}`));
//# sourceMappingURL=index.js.map