import { z, type ZodTypeAny } from "zod";

export type ZodSwiftMetadata = {
    name?: string | undefined;
    description?: string | undefined;
    global?: boolean | undefined;
    experimentalMultipartType?: "file" | "formData" | undefined;
    generator?:
        | {
              yield: z.ZodTypeAny;
              return?: z.ZodTypeAny | undefined;
          }
        | undefined;
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
            generator: metadata.generator ?? this._def.swift?.generator,
        };

        if (this._def.swift?.name) {
            allNamedSchemas.add(this);
        }

        return this;
    };
};

export const unwrapZodType = (type: z.ZodTypeAny): z.ZodTypeAny => {
    if (
        type._def.typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
        type._def.typeName === z.ZodFirstPartyTypeKind.ZodNullable
    ) {
        return unwrapZodType(type._def.innerType);
    }

    if (type._def.typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
        return unwrapZodType(type._def.schema);
    }

    return type;
};
