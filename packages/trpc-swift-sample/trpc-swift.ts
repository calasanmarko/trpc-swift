import type { TRPCSwiftConfiguration } from "trpc-swift";
import { appRouter } from "./src/router";

export default {
    router: appRouter,
    scope: "public",
    models: {
        defaultGlobals: "named",
    },
} satisfies TRPCSwiftConfiguration;
