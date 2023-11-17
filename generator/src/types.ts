import { Procedure, ProcedureParams, RootConfig, Router } from "@trpc/server";
import { RouterDef } from "../node_modules/@trpc/server/src/core/router.js";
import { ZodTypeAny, z } from "zod";

export type TRPCStructure = {
    [key: string]: TRPCStructure | GenericProcedure;
};

export type GenericProcedure = Procedure<"query" | "mutation" | "subscription", ProcedureParams>;

export type SwiftTRPCRouter = Router<
    RouterDef<
        RootConfig<{
            transformer: any;
            errorShape: any;
            ctx: any;
            meta: any;
        }>,
        any,
        any
    >
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ZodType<Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output> {
        swift<T extends ZodTypeAny>(this: T, metadata: ZodSwiftMetadata): T;
    }
}

export const extendZodWithSwift = (zod: typeof z) => {
    zod.ZodType.prototype.swift = function (metadata: ZodSwiftMetadata) {
        this._def.swift = metadata;
        return this;
    };
};
