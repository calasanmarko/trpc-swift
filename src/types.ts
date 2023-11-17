import { Procedure, ProcedureParams, ProcedureRouterRecord, RootConfig } from "@trpc/server";
import { RouterDef } from "../node_modules/@trpc/server/src/core/router.js";
import { ZodTypeAny, z } from "zod";

export type TRPCStructure = {
    [key: string]: TRPCStructure | GenericProcedure;
};

export type GenericProcedure = Procedure<"query" | "mutation" | "subscription", ProcedureParams>;

export type SwiftTRPCRouterDef = RouterDef<
    RootConfig<{
        transformer: unknown;
        errorShape: unknown;
        ctx: never;
        meta: never;
    }>,
    ProcedureRouterRecord,
    never
>;

export type SwiftModelGenerationData = {
    swiftCode: string;
    names: Set<string>;
};

type ZodSwiftMetadata = {
    name?: string;
    description?: string;
};

declare module "zod" {
    interface ZodTypeDef {
        swift?: ZodSwiftMetadata;
    }

    interface ZodType {
        swift<T extends ZodTypeAny>(this: T, metadata: ZodSwiftMetadata): T;
    }
}

export const extendZodWithSwift = (zod: typeof z) => {
    zod.ZodType.prototype.swift = function (metadata: ZodSwiftMetadata) {
        this._def.swift = metadata;
        return this;
    };
};
