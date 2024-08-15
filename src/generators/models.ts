import {
    AnyZodObject,
    ZodArray,
    ZodEffects,
    ZodEnum,
    ZodFirstPartyTypeKind,
    ZodLiteral,
    ZodNullable,
    ZodNumber,
    ZodOptional,
    ZodRecord,
    ZodSet,
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
                return zodCollectionToSwiftType(schema as ZodArray<never>, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodRecord:
                return zodCollectionToSwiftType(schema as ZodRecord<never>, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodSet:
                return zodCollectionToSwiftType(schema as ZodSet<never>, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodEffects:
                return zodEffectsToSwiftType(schema as ZodEffects<never>, state, fallbackName);
            case ZodFirstPartyTypeKind.ZodVoid:
            case ZodFirstPartyTypeKind.ZodUndefined:
                return null;
            case ZodFirstPartyTypeKind.ZodBigInt:
                return { swiftTypeSignature: "Int" };
            case ZodFirstPartyTypeKind.ZodNumber:
                return { swiftTypeSignature: (schema as ZodNumber).isInt ? "Int" : "Double" };
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
        let encodeFunctionContent = "";

        const description = schema._def.swift?.description;
        if (description) {
            swiftModel += `/// ${description}\n`;
        }

        if (state.flags.publicAccess) {
            swiftModel += "public ";
        }

        swiftModel += `struct ${name}: Codable, ${state.flags.conformance} {\n`;
        schema._def.options.forEach((option, index) => {
            const optionType = zodSchemaToSwiftType(
                option,
                {
                    ...state,
                    isAlreadyOptional: false,
                },
                processTypeName("Option" + (index + 1))
            );

            if (optionType) {
                if (optionType.swiftLocalModel) {
                    swiftModel += optionType.swiftLocalModel;
                }

                const optionFieldSignature = processFieldName(optionType.swiftTypeSignature);
                let optionTypeSignature = optionType.swiftTypeSignature;
                if (!optionTypeSignature.endsWith("?")) {
                    optionTypeSignature += "?";
                }

                if (state.flags.publicAccess) {
                    swiftModel += "public ";
                }
                swiftModel += `var ${optionFieldSignature}: ${optionTypeSignature}\n`;

                if (state.flags.publicAccess) {
                    swiftModel += `\npublic init(${optionFieldSignature}: ${optionTypeSignature.slice(0, -1)}) {\n`;
                    swiftModel += `self.${optionFieldSignature} = ${optionFieldSignature}\n`;
                    swiftModel += "}\n";
                }

                encodeFunctionContent += `if let ${optionFieldSignature} = ${optionFieldSignature} {\n`;
                encodeFunctionContent += `return try ${optionFieldSignature}.encode(to: encoder)\n`;
                encodeFunctionContent += "}\n";
            }
        });

        swiftModel += "public func encode(to encoder: any Encoder) throws {\n";
        swiftModel += encodeFunctionContent;
        swiftModel += "}\n";

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

        const publicInitArgs: string[] = [];

        if (state.flags.publicAccess) {
            swiftModel += "public ";
        }

        swiftModel += `struct ${name}: Codable, ${state.flags.conformance} {\n`;
        Object.entries(schema.shape).forEach(([key, value]) => {
            const childType = zodSchemaToSwiftType(
                value as ZodType,
                {
                    ...state,
                    modelDepth: state.modelDepth + 1,
                    visibleModelNames: new Set(state.visibleModelNames),
                    isAlreadyOptional: false,
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

                if (state.flags.publicAccess) {
                    swiftModel += "public ";
                }
                swiftModel += `var ${key}: ${childType.swiftTypeSignature}\n`;

                if (state.flags.publicAccess) {
                    const isArgOptional = childType.swiftTypeSignature.endsWith("?");
                    publicInitArgs.push(`${key}: ${childType.swiftTypeSignature}${isArgOptional ? " = nil" : ""}`);
                }
            }
        });
        if (state.flags.publicAccess) {
            swiftModel += `\npublic init(${publicInitArgs.join(", ")}) {\n`;
            Object.keys(schema.shape).forEach((key) => {
                swiftModel += `self.${key} = ${key}\n`;
            });
            swiftModel += "}\n";
        }
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
            isAlreadyOptional: false,
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

            if (state.flags.publicAccess) {
                swiftModel += "public ";
            }

            const values = Array.isArray(schema._def.values) ? schema._def.values : [schema._def.values];

            swiftModel += `enum ${name}: String, Codable, ${state.flags.conformance} {\n`;
            values.forEach((value) => {
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

const zodCollectionToSwiftType = (
    schema: ZodArray<never> | ZodSet<never> | ZodRecord<never>,
    state: TRPCSwiftModelState,
    fallbackName: string
): SwiftTypeGenerationData | null => {
    const unwrappedResult = zodSchemaToSwiftType(
        schema._def.typeName === ZodFirstPartyTypeKind.ZodArray ? schema._def.type : schema._def.valueType,
        {
            ...state,
            isAlreadyOptional: false,
        },
        fallbackName
    );
    if (!unwrappedResult) {
        return null;
    }

    let swiftTypeSignature = "";
    switch (schema._def.typeName) {
        case ZodFirstPartyTypeKind.ZodArray:
            swiftTypeSignature = `[${unwrappedResult.swiftTypeSignature}]`;
            break;
        case ZodFirstPartyTypeKind.ZodSet:
            swiftTypeSignature = `Set<${unwrappedResult.swiftTypeSignature}>`;
            break;
        case ZodFirstPartyTypeKind.ZodRecord:
            swiftTypeSignature = `[String: ${unwrappedResult.swiftTypeSignature}]`;
            break;
        default:
            break;
    }

    return {
        swiftTypeSignature,
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
