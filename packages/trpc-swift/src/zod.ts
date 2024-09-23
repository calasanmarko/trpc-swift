import type { ZodTypeAny, z } from "zod";

export type ZodSwiftMetadata = {
    name?: string;
    description?: string;
    global?: boolean;
    experimentalMultipartType?: "file" | "formData";
};

declare module "zod" {
    interface ZodTypeDef {
        swift?: ZodSwiftMetadata;
    }

    interface ZodType {
        swift<T extends ZodTypeAny>(this: T, metadata: ZodSwiftMetadata): T;
    }
}

export const allNamedSchemas = new Set<z.ZodType>();

export const extendZodWithSwift = (zod: typeof z) => {
    zod.ZodType.prototype.swift = function (metadata: ZodSwiftMetadata) {
        this._def.swift = {
            name: metadata.name ?? this._def.swift?.name,
            description: metadata.description ?? this._def.swift?.description,
            global: metadata.global ?? this._def.swift?.global,
            experimentalMultipartType: metadata.experimentalMultipartType ?? this._def.swift?.experimentalMultipartType,
        };

        if (this._def.swift?.name) {
            allNamedSchemas.add(this);
        }

        return this;
    };
};
