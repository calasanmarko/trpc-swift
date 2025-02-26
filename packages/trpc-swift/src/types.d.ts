import type { AnyRouter, AnyTRPCProcedure, initTRPC } from "@trpc/server";

export declare type TRPCSwiftFullConfiguration = {
    router: AnyRouter;
    permissionScope: "internal" | "public";
    outFile?: string;
    conformance: {
        structs: string[];
        enums: string[];
    };
    procedures: {
        include: "all" | "none";
        subscriptionMode: "none" | "sse";
    };
    models:
        | {
              include: "referenced";
              makeGlobal: "all" | "none";
          }
        | {
              include: "all";
              makeGlobal: "all";
          };
    literals: {
        autoAssignInInitializers: boolean;
    };
};
export declare type TRPCSwiftConfiguration = Partial<TRPCSwiftFullConfiguration> &
    Pick<TRPCSwiftFullConfiguration, "router">;

export type TRPCSwiftMeta = {
    swift?: {
        include?: boolean;
        description?: string;
    };
};

export type TRPCCreateResult = ReturnType<ReturnType<typeof initTRPC.meta<TRPCSwiftMeta>>["create"]>;
export type TRPCAppRouter = ReturnType<TRPCCreateResult["router"]>;
export type TRPCProcedureWithInput = AnyTRPCProcedure & {
    _def: AnyTRPCProcedure["_def"] & {
        meta?: TRPCSwiftMeta;
        inputs: (z.ZodType | undefined)[];
        output?: (z.ZodType | undefined) | undefined;
    };
};
export type TRPCChildRouter = Record<string, TRPCProcedureWithInput>;

export type ZodPrimitiveData = { name: string; definition?: string };

export type MappedProperties = Record<
    string,
    { typeName: string; schema: z.ZodType; experimentalMultipartType: "file" | "formData" | undefined }
>;
