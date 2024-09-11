import type { AnyRouter, AnyTRPCProcedure, initTRPC } from "@trpc/server";

export declare type TRPCSwiftFullConfiguration = {
    router: AnyRouter;
    permissionScope: "internal" | "public";
    outFile: string;
    conformance: {
        structs: string[];
        enums: string[];
    };
    models: {
        defaultGlobals: "named" | "none";
    };
};
export declare type TRPCSwiftConfiguration = Partial<TRPCSwiftFullConfiguration> &
    Pick<TRPCSwiftFullConfiguration, "router" | "outFile">;

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
