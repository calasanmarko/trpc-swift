import { ZodArray, ZodFirstPartyTypeKind, ZodNullable, ZodObject, ZodOptional, ZodType, z } from "zod";
import { SwiftModelGenerationData, extendZodWithSwift } from "../types.js";
import { processTypeName } from "../utility.js";

extendZodWithSwift(z);

export const zodSchemaToSwiftType = (
    schema: ZodType,
    globalModels: SwiftModelGenerationData,
    fallbackName: string
): {
    swiftTypeSignature: string;
    swiftLocalModel?: string;
} => {
    if (schema instanceof ZodObject) {
        const zodSwiftName = schema._def.swift?.name;
        if (zodSwiftName) {
            if (globalModels.names.has(zodSwiftName)) {
                return {
                    swiftTypeSignature: zodSwiftName,
                };
            }
            globalModels.names.add(zodSwiftName);
        }

        const swiftTypeSignature = processTypeName(zodSwiftName ?? fallbackName);

        let swiftLocalModel = `struct ${swiftTypeSignature}: Codable, Equatable {\n`;
        Object.entries(schema.shape).forEach(([key, value]) => {
            const childType = zodSchemaToSwiftType(value as ZodType, globalModels, processTypeName(key + "Type"));
            if (childType.swiftLocalModel) {
                swiftLocalModel += childType.swiftLocalModel;
            }
            swiftLocalModel += `var ${key}: ${childType.swiftTypeSignature}\n`;
        });
        swiftLocalModel += "}\n";

        return {
            swiftTypeSignature,
            swiftLocalModel,
        };
    } else if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
        const unwrappedResult = zodSchemaToSwiftType(schema._def.innerType, globalModels, fallbackName);
        return {
            swiftTypeSignature: `${unwrappedResult.swiftTypeSignature}?`,
            swiftLocalModel: unwrappedResult.swiftLocalModel,
        };
    } else if (schema instanceof ZodArray) {
        const unwrappedResult = zodSchemaToSwiftType(schema._def.type, globalModels, fallbackName);
        return {
            swiftTypeSignature: `[${unwrappedResult.swiftTypeSignature}]`,
            swiftLocalModel: unwrappedResult.swiftLocalModel,
        };
    } else if ("typeName" in schema._def) {
        switch (schema._def.typeName as ZodFirstPartyTypeKind) {
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

    throw new Error("Unsupported schema type.");
};
