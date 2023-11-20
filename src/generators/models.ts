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
import { SwiftTypeGenerationData, TRPCSwiftModelState } from "../types.js";
import { processFieldName, processTypeName } from "../utility.js";
import { extendZodWithSwift } from "../extensions/zod.js";

extendZodWithSwift(z);

export const zodSchemaToSwiftType = (schema: ZodType, state: TRPCSwiftModelState, fallbackName: string): SwiftTypeGenerationData | null => {
    if ("typeName" in schema._def) {
        switch (schema._def.typeName as ZodFirstPartyTypeKind) {
            case ZodFirstPartyTypeKind.ZodUnion:
                return zodUnionToSwiftType(schema as ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodObject:
                return zodObjectToSwiftType(schema as AnyZodObject, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodEnum:
                return zodEnumToSwiftType(schema as ZodEnum<[string, ...string[]]>, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodOptional:
            case ZodFirstPartyTypeKind.ZodNullable:
                return zodOptionalOrNullableToSwiftType(schema as ZodOptional<never> | ZodNullable<never>, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodArray:
                return zodArrayToSwiftType(schema as ZodArray<never>, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodEffects:
                return zodEffectsToSwiftType(schema as ZodEffects<never>, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodVoid:
            case ZodFirstPartyTypeKind.ZodUndefined:
                return null;
            case ZodFirstPartyTypeKind.ZodBigInt:
            case ZodFirstPartyTypeKind.ZodNumber:
                return { swiftTypeSignature: "Int" };
            case ZodFirstPartyTypeKind.ZodBoolean:
                return { swiftTypeSignature: "Bool" };
            case ZodFirstPartyTypeKind.ZodDate:
                return { swiftTypeSignature: "Date" };
            case ZodFirstPartyTypeKind.ZodString:
                return { swiftTypeSignature: "String" };
            case ZodFirstPartyTypeKind.ZodLiteral:
                return zodEnumToSwiftType(z.enum((schema as ZodLiteral<never>)._def.value), state, fallbackName);
            default:
                break;
        }
    }

    throw new Error("Unsupported schema type: " + (schema._def as { typeName: ZodFirstPartyTypeKind }).typeName);
};

const zodUnionToSwiftType = (
    schema: ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>,
    state: TRPCSwiftModelState,
    fallbackName: string
): SwiftTypeGenerationData | null => {
    return wrapZodSchemaWithModels(schema, state, fallbackName, (name) => {
        let swiftModel = "";

        const description = schema._def.swift?.description;
        if (description) {
            swiftModel += `/// ${description}\n`;
        }

        swiftModel += `struct ${name}: Codable, Equatable {\n`;
        schema._def.options.forEach((option, index) => {
            const optionType = zodSchemaToSwiftType(option, state, processTypeName("Option" + (index + 1)));

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

const zodObjectToSwiftType = (schema: AnyZodObject, state: TRPCSwiftModelState, fallbackName: string): SwiftTypeGenerationData => {
    return wrapZodSchemaWithModels(schema, state, fallbackName, (name) => {
        let swiftModel = "";

        const description = schema._def.swift?.description;
        if (description) {
            swiftModel += `/// ${description}\n`;
        }

        swiftModel = `struct ${name}: Codable, Equatable {\n`;
        Object.entries(schema.shape).forEach(([key, value]) => {
            const childType = zodSchemaToSwiftType(
                value as ZodType,
                {
                    ...state,
                    modelDepth: state.modelDepth + 1,
                    visibleModelNames: new Set(state.visibleModelNames),
                },
                processTypeName(key)
            );
            if (childType) {
                if (childType.swiftLocalModel) {
                    swiftModel += childType.swiftLocalModel;
                }

                const childDescription = (value as ZodType)._def.swift?.description;
                if (childDescription) {
                    swiftModel += `/// ${childDescription}\n`;
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
    state: TRPCSwiftModelState,
    fallbackName: string
): SwiftTypeGenerationData | null => {
    return wrapZodSchemaWithModels(
        schema,
        {
            ...state,
            modelDepth: state.modelDepth + 1,
            visibleModelNames: new Set(state.visibleModelNames),
        },
        fallbackName,
        (name) => {
            if (!schema._def.values) {
                return null;
            }

            let swiftModel = "";
            const description = schema._def.swift?.description;
            if (description) {
                swiftModel += `/// ${description}\n`;
            }

            swiftModel = `enum ${name}: String, Codable {\n`;
            schema._def.values.forEach((value) => {
                swiftModel += `case ${processFieldName(value)} = "${value}"\n`;
            });
            swiftModel += "}\n";

            return swiftModel;
        }
    );
};

const zodOptionalOrNullableToSwiftType = (
    schema: ZodOptional<never> | ZodNullable<never>,
    state: TRPCSwiftModelState,
    fallbackName: string
): SwiftTypeGenerationData | null => {
    const unwrappedResult = zodSchemaToSwiftType(
        schema._def.innerType,
        {
            ...state,
            modelDepth: state.modelDepth + 1,
            isAlreadyOptional: true,
        },
        fallbackName
    );
    if (!unwrappedResult) {
        return null;
    }

    return {
        swiftTypeSignature: `${unwrappedResult.swiftTypeSignature}${state.isAlreadyOptional ? "" : "?"}`,
        swiftLocalModel: unwrappedResult.swiftLocalModel,
    };
};

const zodArrayToSwiftType = (schema: ZodArray<never>, state: TRPCSwiftModelState, fallbackName: string): SwiftTypeGenerationData | null => {
    const unwrappedResult = zodSchemaToSwiftType(schema._def.type, state, fallbackName);
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
    state: TRPCSwiftModelState,
    fallbackName: string
): SwiftTypeGenerationData | null => {
    return zodSchemaToSwiftType(schema._def.schema, state, fallbackName);
};

const wrapZodSchemaWithModels = (
    schema: AnyZodObject | ZodEnum<[string, ...string[]]> | ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>,
    state: TRPCSwiftModelState,
    fallbackName: string,
    modelGenerator: (name: string) => string | null
): SwiftTypeGenerationData | null => {
    const zodSwiftName = schema._def.swift?.name;
    const shouldBeGlobal =
        schema._def.swift?.name &&
        (schema._def.swift.global || state.flags.globalMode === "all" || (state.flags.globalMode === "top" && state.modelDepth === 0));
    const finalName = zodSwiftName ?? fallbackName;

    if (state.visibleModelNames.has(finalName) || state.globalModels.names.has(finalName)) {
        return {
            swiftTypeSignature: finalName,
        };
    }

    const swiftTypeSignature = processTypeName(finalName);
    const swiftModel = modelGenerator(swiftTypeSignature);
    if (!swiftModel) {
        return null;
    }

    const swiftLocalModel = shouldBeGlobal ? undefined : swiftModel;
    if (shouldBeGlobal) {
        state.globalModels.names.add(finalName);
        state.globalModels.swiftCode += swiftModel;
    }

    state.visibleModelNames.add(finalName);

    return {
        swiftTypeSignature,
        swiftLocalModel,
    };
};
