import { Procedure, ProcedureParams } from "@trpc/server";
import { GenericProcedure, SwiftModelGenerationData, SwiftTRPCRouter, TRPCStructure, extendZodWithSwift } from "../types.js";
import { ZodType, z } from "zod";
import { processTypeName } from "../utility.js";
import { zodSchemaToSwiftType } from "./models.js";

extendZodWithSwift(z);

export const getTRPCStructure = (router: SwiftTRPCRouter): TRPCStructure => {
    const structure: TRPCStructure = {};
    Object.entries(router._def.procedures).forEach(([key, procedure]) => {
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

export const trpcStructureToSwiftClass = (
    name: string,
    structure: TRPCStructure,
    metadata:
        | {
              isRoot: true;
              fullPath: string;
              globalModels?: never;
          }
        | {
              isRoot?: never;
              fullPath: string;
              globalModels: SwiftModelGenerationData;
          }
): string => {
    let swiftClass = `class ${processTypeName(name)} {\n`;

    if (metadata.isRoot) {
        swiftClass += "var url: URL\n\n";
        swiftClass += "init(url: URL) {\n";
        swiftClass += "self.url = url\n";
        swiftClass += "}\n";
    } else {
        swiftClass += "var url: URL {\n";
        swiftClass += `AppClient.shared.url.appendingComponents(".${name}")\n`;
        swiftClass += "}\n";
    }

    swiftClass += "\n";

    const resolvedGlobalModels = metadata.globalModels ?? {
        swiftCode: "",
        names: new Set<string>(),
    };

    let innerSwiftCode = "";

    Object.entries(structure).forEach(([key, value]) => {
        if (isProcedure(value)) {
            innerSwiftCode += trpcProcedureToSwiftMethodAndLocalModels(key, value, resolvedGlobalModels);
        } else {
            innerSwiftCode += trpcStructureToSwiftClass(key, value, { globalModels: resolvedGlobalModels });
        }
    });

    if (metadata.isRoot && resolvedGlobalModels.swiftCode) {
        swiftClass += resolvedGlobalModels.swiftCode + "\n";
    }

    swiftClass += innerSwiftCode;
    swiftClass += "}\n";

    return swiftClass;
};

const trpcProcedureToSwiftMethodAndLocalModels = (
    name: string,
    procedure: Procedure<"query" | "mutation" | "subscription", ProcedureParams>,
    globalModels: SwiftModelGenerationData
): string => {
    let swiftLocalModels = "";
    let swiftMethod = `func ${name}(`;

    if (procedure._def.inputs.length > 1) {
        throw new Error("Multiple inputs not supported.");
    }

    const input = procedure._def.inputs.at(0);
    if (input) {
        const schemaType = zodSchemaToSwiftType(input as ZodType, globalModels, processTypeName(name + "InputType"));
        const swiftParam = `input: ${schemaType.swiftTypeSignature}`;

        if (schemaType.swiftLocalModel) {
            swiftLocalModels += schemaType.swiftLocalModel + "\n";
        }

        swiftMethod += swiftParam;
    }

    swiftMethod += ") async throws";

    if (procedure._def.output) {
        const output = procedure._def.output;
        const schemaType = zodSchemaToSwiftType(output as ZodType, globalModels, processTypeName(name + "OutputType"));

        if (schemaType.swiftLocalModel) {
            swiftLocalModels += schemaType.swiftLocalModel + "\n";
        }

        swiftMethod += ` -> ${schemaType.swiftTypeSignature}`;
    }

    swiftMethod += " {\n";

    if (procedure._def.query) {
        swiftMethod += "return try await TRPCClient.shared.sendQuery(url: url, input: input)\n";
    } else if (procedure._def.mutation) {
        swiftMethod += "return try await TRPCClient.shared.sendMutation(url: url, input: input\n";
    } else {
        throw new Error("Unsupported procedure type.");
    }

    swiftMethod += "}\n";

    return swiftLocalModels + "\n" + swiftMethod;
};

const isProcedure = (trpcStructureValue: TRPCStructure | GenericProcedure): trpcStructureValue is GenericProcedure => {
    return "_def" in trpcStructureValue;
};
