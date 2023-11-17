import { AnyZodObject, ZodArray, ZodEffects, ZodFirstPartyTypeKind, ZodNullable, ZodOptional, ZodType, z } from "zod";
import { SwiftModelGenerationData, extendZodWithSwift } from "../types.js";
import { processTypeName } from "../utility.js";

extendZodWithSwift(z);

export const zodSchemaToSwiftType = (
    schema: ZodType,
    globalModels: SwiftModelGenerationData,
    fallbackName: string,
    alreadyOptional: boolean = false
): {
    swiftTypeSignature: string | null;
    swiftLocalModel?: string;
} => {
    if ("typeName" in schema._def) {
        switch (schema._def.typeName as ZodFirstPartyTypeKind) {
            case ZodFirstPartyTypeKind.ZodObject:
                return zodObjectToSwiftType(schema as AnyZodObject, globalModels, fallbackName);
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
                return { swiftTypeSignature: null };
            case ZodFirstPartyTypeKind.ZodBigInt:
            case ZodFirstPartyTypeKind.ZodNumber:
                return { swiftTypeSignature: "Int" };
            case ZodFirstPartyTypeKind.ZodBoolean:
                return { swiftTypeSignature: "Bool" };
            case ZodFirstPartyTypeKind.ZodDate:
                return { swiftTypeSignature: "Date" };
            case ZodFirstPartyTypeKind.ZodString:
                return { swiftTypeSignature: "String" };
            default:
                break;
        }
    }

    console.error("Unsupported schema type.", schema);
    return { swiftTypeSignature: "Any?" };
};

const zodObjectToSwiftType = (
    schema: AnyZodObject,
    globalModels: SwiftModelGenerationData,
    fallbackName: string
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} => {
    const zodSwiftName = schema._def.swift?.name;
    console.log("ZODNAME", zodSwiftName);
    if (zodSwiftName) {
        if (globalModels.names.has(zodSwiftName)) {
            return {
                swiftTypeSignature: zodSwiftName,
            };
        }
        globalModels.names.add(zodSwiftName);
    }

    const swiftTypeSignature = processTypeName(zodSwiftName ?? fallbackName);

    let swiftModel = `struct ${swiftTypeSignature}: Codable, Equatable {\n`;
    Object.entries(schema.shape).forEach(([key, value]) => {
        const childType = zodSchemaToSwiftType(value as ZodType, globalModels, processTypeName(key + "Type"));
        if (childType.swiftLocalModel) {
            swiftModel += childType.swiftLocalModel;
        }
        swiftModel += `var ${key}: ${childType.swiftTypeSignature}\n`;
    });
    swiftModel += "}\n";

    const swiftLocalModel = zodSwiftName ? undefined : swiftModel;
    if (zodSwiftName) {
        globalModels.swiftCode += swiftModel;
    }

    return {
        swiftTypeSignature,
        swiftLocalModel,
    };
};

const zodOptionalOrNullableToSwiftType = (
    schema: ZodOptional<never> | ZodNullable<never>,
    globalModels: SwiftModelGenerationData,
    fallbackName: string,
    alreadyOptional: boolean
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} => {
    const unwrappedResult = zodSchemaToSwiftType(schema._def.innerType, globalModels, fallbackName, true);
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
} => {
    const unwrappedResult = zodSchemaToSwiftType(schema._def.type, globalModels, fallbackName);
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
    swiftTypeSignature: string | null;
    swiftLocalModel?: string;
} => {
    const unwrappedResult = zodSchemaToSwiftType(schema._def.schema, globalModels, fallbackName, alreadyOptional);
    return {
        swiftTypeSignature: unwrappedResult.swiftTypeSignature,
        swiftLocalModel: unwrappedResult.swiftLocalModel,
    };
};
