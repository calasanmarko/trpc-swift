import type { AnyRouter, AnyTRPCProcedure, initTRPC } from "@trpc/server";

export declare type TRPCSwiftConfiguration = {
    router: AnyRouter;
    permissionScope: "internal" | "public";
    models: {
        defaultGlobals: "named" | "none";
    };
};

export type TRPCCreateResult = ReturnType<typeof initTRPC.create>;
export type TRPCAppRouter = ReturnType<TRPCCreateResult["router"]>;
export type TRPCProcedureWithInput = AnyTRPCProcedure & {
    _def: AnyTRPCProcedure["_def"] & {
        inputs: unknown[];
        output?: unknown | undefined;
    };
};
export type TRPCChildRouter = Record<string, TRPCProcedureWithInput>;

export type ZodPrimitiveData = { name: string; definition?: string };
