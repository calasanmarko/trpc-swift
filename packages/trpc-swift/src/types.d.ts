import type { AnyRouter } from "@trpc/server";

export declare type TRPCSwiftConfiguration = {
    router: AnyRouter;
    scope: "internal" | "public";
    models: {
        defaultGlobals: "all" | "named" | "none";
    };
};
