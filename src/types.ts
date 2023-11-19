import { AnyRootConfig, Procedure, ProcedureParams, ProcedureRouterRecord, RootConfig } from "@trpc/server";
import { RouterDef } from "../node_modules/@trpc/server/src/core/router.js";
import { TRPCSwiftMeta } from "./extensions/trpc.js";

export type TRPCSwiftGlobalMode = "all" | "top" | "none";

export type TRPCSwiftFlags = {
    createTypeAliases: boolean;
    createShared: boolean;
    globalMode: "all" | "top" | "none";
    quiet: boolean;
};

export type TRPCStructure = {
    [key: string]: TRPCStructure | GenericProcedure;
};

export type GenericProcedure = Procedure<
    "query" | "mutation" | "subscription",
    ProcedureParams<AnyRootConfig, unknown, unknown, unknown, unknown, unknown, TRPCSwiftMeta>
>;

export type SwiftTRPCRouterDef = RouterDef<
    RootConfig<{
        transformer: unknown;
        errorShape: unknown;
        ctx: never;
        meta: TRPCSwiftMeta;
    }>,
    ProcedureRouterRecord,
    never
>;

export type SwiftModelGenerationData = {
    swiftCode: string;
    names: Set<string>;
};

export type TRPCSwiftRouteState = {
    routeDepth: number;
    globalModels: SwiftModelGenerationData;
    visibleModelNames: Set<string>;
    flags: TRPCSwiftFlags;
};

export type TRPCSwiftModelState = TRPCSwiftRouteState & {
    modelDepth: number;
    isAlreadyOptional: boolean;
};
