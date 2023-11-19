import {
    AnyZodObject,
    ZodArray,
    ZodEffects,
    ZodEnum,
    ZodFirstPartyTypeKind,
    ZodLiteral,
    ZodNullable,
    ZodOptional,
    ZodType,
    ZodTypeAny,
    ZodUnion,
    z,
} from "zod";
import { SwiftModelGenerationData, extendZodWithSwift } from "../types.js";
import { processFieldName, processTypeName } from "../utility.js";

extendZodWithSwift(z);

export const zodSchemaToSwiftType = (
    schema: ZodType,
    globalModels: SwiftModelGenerationData,
    fallbackName: string,
    alreadyOptional: boolean = false
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} | null => {
    if ("typeName" in schema._def) {
        switch (schema._def.typeName as ZodFirstPartyTypeKind) {
            case ZodFirstPartyTypeKind.ZodUnion:
                return zodUnionToSwiftType(schema as ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>, globalModels, fallbackName);
            case ZodFirstPartyTypeKind.ZodObject:
                return zodObjectToSwiftType(schema as AnyZodObject, globalModels, fallbackName);
            case ZodFirstPartyTypeKind.ZodEnum:
                return zodEnumToSwiftType(schema as ZodEnum<[string, ...string[]]>, globalModels, fallbackName);
            case ZodFirstPartyTypeKind.ZodOptional:
            case ZodFirstPartyTypeKind.ZodNullable:
                return zodOptionalOrNullableToSwiftType(
                    schema as ZodOptional<never> | ZodNullable<never>,
                    globalModels,
                    fallbackName,
                    alreadyOptional
                );
            case ZodFirstPartyTypeKind.ZodArray:
                return zodArrayToSwiftType(schema as ZodArray<never>, globalModels, fallbackName);
            case ZodFirstPartyTypeKind.ZodEffects:
                return zodEffectsToSwiftType(schema as ZodEffects<never>, globalModels, fallbackName, alreadyOptional);
            case ZodFirstPartyTypeKind.ZodVoid:
            case ZodFirstPartyTypeKind.ZodUndefined:
                return null;
            case ZodFirstPartyTypeKind.ZodBigInt:
            case ZodFirstPartyTypeKind.ZodNumber:
                return { swiftTypeSignature: "Int" };
            case ZodFirstPartyTypeKind.ZodBoolean:
                return { swiftTypeSignature: "Bool" };
            case ZodFirstPartyTypeKind.ZodDate:
            case ZodFirstPartyTypeKind.ZodString:
                return { swiftTypeSignature: "String" };
            case ZodFirstPartyTypeKind.ZodLiteral:
                return zodEnumToSwiftType(z.enum((schema as ZodLiteral<never>)._def.value), globalModels, fallbackName);
            default:
                break;
        }
    }

    throw new Error("Unsupported schema type: " + (schema._def as { typeName: ZodFirstPartyTypeKind }).typeName);
};

const zodUnionToSwiftType = (
    schema: ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>,
    globalModels: SwiftModelGenerationData,
    fallbackName: string
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} | null => {
    return wrapZodSchemaWithModels(schema, globalModels, fallbackName, (name) => {
        let swiftModel = `struct ${name}: Codable, Equatable {\n`;
        schema._def.options.forEach((option, index) => {
            const optionType = zodSchemaToSwiftType(option, globalModels, processTypeName("Option" + (index + 1)));

            if (optionType) {
                if (optionType.swiftLocalModel) {
                    swiftModel += optionType.swiftLocalModel;
                }

                const optionFieldSignature = processFieldName(optionType.swiftTypeSignature);
                let optionTypeSignature = optionType.swiftTypeSignature;
                if (!optionTypeSignature.endsWith("?")) {
                    optionTypeSignature += "?";
                }

                swiftModel += `var ${optionFieldSignature}: ${optionTypeSignature}\n`;
            }
        });
        swiftModel += "}\n";

        return swiftModel;
    });
};

const zodObjectToSwiftType = (
    schema: AnyZodObject,
    globalModels: SwiftModelGenerationData,
    fallbackName: string
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} => {
    return wrapZodSchemaWithModels(schema, globalModels, fallbackName, (name) => {
        let swiftModel = `struct ${name}: Codable, Equatable {\n`;
        Object.entries(schema.shape).forEach(([key, value]) => {
            const childType = zodSchemaToSwiftType(value as ZodType, globalModels, processTypeName(key));
            if (childType) {
                if (childType.swiftLocalModel) {
                    swiftModel += childType.swiftLocalModel;
                }
                swiftModel += `var ${key}: ${childType.swiftTypeSignature}\n`;
            }
        });
        swiftModel += "}\n";

        return swiftModel;
    })!;
};

const zodEnumToSwiftType = (
    schema: ZodEnum<[string, ...string[]]>,
    globalModels: SwiftModelGenerationData,
    fallbackName: string
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} | null => {
    return wrapZodSchemaWithModels(schema, globalModels, fallbackName, (name) => {
        if (!schema._def.values) {
            return null;
        }

        let swiftModel = `enum ${name}: String, Codable {\n`;
        schema._def.values.forEach((value) => {
            swiftModel += `case ${processFieldName(value)} = "${value}"\n`;
        });
        swiftModel += "}\n";

        return swiftModel;
    });
};

const zodOptionalOrNullableToSwiftType = (
    schema: ZodOptional<never> | ZodNullable<never>,
    globalModels: SwiftModelGenerationData,
    fallbackName: string,
    alreadyOptional: boolean
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} | null => {
    const unwrappedResult = zodSchemaToSwiftType(schema._def.innerType, globalModels, fallbackName, true);
    if (!unwrappedResult) {
        return null;
    }

    return {
        swiftTypeSignature: `${unwrappedResult.swiftTypeSignature}${alreadyOptional ? "" : "?"}`,
        swiftLocalModel: unwrappedResult.swiftLocalModel,
    };
};

const zodArrayToSwiftType = (
    schema: ZodArray<never>,
    globalModels: SwiftModelGenerationData,
    fallbackName: string
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} | null => {
    const unwrappedResult = zodSchemaToSwiftType(schema._def.type, globalModels, fallbackName);
    if (!unwrappedResult) {
        return null;
    }

    return {
        swiftTypeSignature: `[${unwrappedResult.swiftTypeSignature}]`,
        swiftLocalModel: unwrappedResult.swiftLocalModel,
    };
};

const zodEffectsToSwiftType = (
    schema: ZodEffects<never>,
    globalModels: SwiftModelGenerationData,
    fallbackName: string,
    alreadyOptional: boolean
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} | null => {
    return zodSchemaToSwiftType(schema._def.schema, globalModels, fallbackName, alreadyOptional);
};

const wrapZodSchemaWithModels = (
    schema: AnyZodObject | ZodEnum<[string, ...string[]]> | ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>,
    globalModels: SwiftModelGenerationData,
    fallbackName: string,
    modelGenerator: (name: string) => string | null
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} | null => {
    const zodSwiftName = schema._def.swift?.name;
    if (zodSwiftName) {
        if (globalModels.names.has(zodSwiftName)) {
            return {
                swiftTypeSignature: zodSwiftName,
            };
        }
    }

    const swiftTypeSignature = processTypeName(zodSwiftName ?? fallbackName);
    const swiftModel = modelGenerator(swiftTypeSignature);
    if (!swiftModel) {
        return null;
    }

    const swiftLocalModel = zodSwiftName ? undefined : swiftModel;
    if (zodSwiftName) {
        globalModels.swiftCode += swiftModel;
        globalModels.names.add(zodSwiftName);
    }

    return {
        swiftTypeSignature,
        swiftLocalModel,
    };
};
