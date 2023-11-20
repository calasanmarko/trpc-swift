import { GenericProcedure, SwiftTRPCRouterDef, TRPCStructure, TRPCSwiftRouteState } from "../types.js";
import { ZodType, z } from "zod";
import { processFieldName, processTypeName } from "../utility.js";
import { zodSchemaToSwiftType } from "./models.js";
import { extendZodWithSwift } from "../extensions/zod.js";

extendZodWithSwift(z);

export const getTRPCStructure = (routerDef: SwiftTRPCRouterDef): TRPCStructure => {
    const structure: TRPCStructure = {};
    Object.entries(routerDef.procedures).forEach(([key, procedure]) => {
        const pathParts = key.split(".");

        let currentStructure: TRPCStructure = structure;
        pathParts.forEach((part, index) => {
            if (index === pathParts.length - 1) {
                currentStructure[part] = procedure as GenericProcedure;
            }
            currentStructure[part] ||= {};
            currentStructure = currentStructure[part] as TRPCStructure;
        });
    });

    return structure;
};

export const trpcStructureToSwiftClass = (name: string, structure: TRPCStructure, state: TRPCSwiftRouteState): string => {
    const className = processTypeName(name) + (state.routeDepth ? "Route" : "");
    let swiftClass = `class ${className}: TRPCClientData {\n`;

    let innerSwiftCode = "";
    const childStructureNames: string[] = [];

    Object.entries(structure).forEach(([key, value]) => {
        if (isProcedure(value)) {
            innerSwiftCode += trpcProcedureToSwiftMethodAndLocalModels(key, value, state);
        } else {
            innerSwiftCode += trpcStructureToSwiftClass(key, value, {
                ...state,
                routeDepth: state.routeDepth + 1,
                visibleModelNames: new Set(state.visibleModelNames),
            });
            childStructureNames.push(key);
        }
    });

    childStructureNames.forEach((child) => {
        swiftClass += `lazy var ${processFieldName(child)} = ${processTypeName(child) + "Route"}(clientData: self)\n`;
    });

    if (childStructureNames.length > 0) {
        swiftClass += "\n";
    }

    if (state.routeDepth === 0) {
        if (state.flags.createShared) {
            swiftClass += `static let shared = ${className}()\n\n`;
        }
        swiftClass += `var baseUrl: URL${state.flags.createShared ? "!" : ""}\n`;
        swiftClass += "var baseMiddlewares: [TRPCMiddleware] = []\n\n";
        swiftClass += "var url: URL {\n";
        swiftClass += "baseUrl\n";
        swiftClass += "}\n\n";
        swiftClass += "var middlewares: [TRPCMiddleware] {\n";
        swiftClass += "baseMiddlewares\n";
        swiftClass += "}\n\n";
        swiftClass += `init(baseUrl: URL${state.flags.createShared ? "? = nil" : ""}, middlewares: [TRPCMiddleware] = []) {\n`;
        swiftClass += "self.baseUrl = baseUrl\n";
        swiftClass += "self.baseMiddlewares = middlewares\n";
        swiftClass += "}\n";
    } else {
        swiftClass += "let clientData: TRPCClientData\n\n";
        swiftClass += "var url: URL {\n";
        if (state.routeDepth === 1) {
            swiftClass += `clientData.url.appendingPathComponent("${name}")\n`;
        } else {
            swiftClass += `clientData.url.appendingPathExtension("${name}")\n`;
        }
        swiftClass += "}\n\n";
        swiftClass += "var middlewares: [TRPCMiddleware] {\n";
        swiftClass += "clientData.middlewares\n";
        swiftClass += "}\n\n";
        swiftClass += "init(clientData: TRPCClientData) {\n";
        swiftClass += "self.clientData = clientData\n";
        swiftClass += "}\n";
    }

    swiftClass += "\n";

    if (state.routeDepth === 0 && state.globalModels.swiftCode) {
        swiftClass += state.globalModels.swiftCode + "\n";
    }

    swiftClass += innerSwiftCode;
    swiftClass += "}\n";

    return swiftClass;
};

const trpcProcedureToSwiftMethodAndLocalModels = (name: string, procedure: GenericProcedure, state: TRPCSwiftRouteState): string => {
    try {
        let swiftLocalModels = "";
        let swiftMethod = "";

        const description = procedure._def.meta?.swift?.description;
        if (description) {
            swiftMethod += `/// ${description}\n`;
        }

        swiftMethod += `func ${name}(`;

        if (procedure._def.inputs.length > 1) {
            throw new Error("Multiple inputs not supported.");
        }

        const input = procedure._def.inputs.at(0);
        let addedInput = false;
        if (input) {
            const schemaType = zodSchemaToSwiftType(
                input as ZodType,
                {
                    ...state,
                    modelDepth: 0,
                    isAlreadyOptional: false,
                },
                processTypeName(name + "InputType")
            );

            if (schemaType) {
                if (schemaType.swiftTypeSignature) {
                    const swiftParam = `input: ${schemaType.swiftTypeSignature}`;

                    if (schemaType.swiftLocalModel) {
                        swiftLocalModels += schemaType.swiftLocalModel + "\n";
                    }

                    swiftMethod += swiftParam;
                    addedInput = true;
                }
            }
        }

        swiftMethod += ") async throws";

        let outputType = "TRPCClient.EmptyObject";
        if (procedure._def.output) {
            const output = procedure._def.output;
            const schemaType = zodSchemaToSwiftType(
                output as ZodType,
                {
                    ...state,
                    modelDepth: 0,
                    isAlreadyOptional: false,
                },
                processTypeName(name + "OutputType")
            );

            if (schemaType) {
                if (schemaType.swiftTypeSignature) {
                    if (schemaType.swiftLocalModel) {
                        swiftLocalModels += schemaType.swiftLocalModel + "\n";
                    }

                    outputType = schemaType.swiftTypeSignature;
                }
            }
        }

        swiftMethod += ` -> ${outputType} {\n`;

        if (procedure._def.query) {
            swiftMethod += `return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("${name}"), middlewares: middlewares, input: ${
                addedInput ? "input" : "TRPCClient.EmptyObject()"
            })\n`;
        } else if (procedure._def.mutation) {
            swiftMethod += `return try await TRPCClient.shared.sendMutation(url: url.appendingPathExtension("${name}"), middlewares: middlewares, input: ${
                addedInput ? "input" : "TRPCClient.EmptyObject()"
            })\n`;
        } else {
            throw new Error("Unsupported procedure type.");
        }

        swiftMethod += "}\n";

        return swiftLocalModels + "\n" + swiftMethod;
    } catch (e) {
        if (!state.flags.quiet) {
            console.error(`Error while processing procedure ${name}: ${(e as Error).message}`);
        }
        return "";
    }
};

const isProcedure = (trpcStructureValue: TRPCStructure | GenericProcedure): trpcStructureValue is GenericProcedure => {
    return "_def" in trpcStructureValue;
};
