import { type ProcedureRouterRecord, type Router } from "@trpc/server";
import type { RouterDef } from "../node_modules/@trpc/server/src/core/router.js";
import type { AnyProcedure, RootConfig } from "@trpc/server";
import { appRouter } from "trpc-swift-demo";
import { writeFileSync } from "fs";
import { AnyZodObject, ZodAny, ZodArray, ZodFirstPartyTypeKind, ZodNullable, ZodObject, ZodOptional, ZodTypeAny } from "zod";

export type SwiftTRPCRouter<TRecord extends ProcedureRouterRecord> = Router<
    RouterDef<
        RootConfig<{
            transformer: any;
            errorShape: any;
            ctx: any;
            meta: any;
        }>,
        TRecord,
        any
    >
>;

type NestedObject = { [key: string]: any };
type NestedStructure = { [key: string]: NestedObject | AnyProcedure };

export const generateSwiftAppRouter = <TRecord extends ProcedureRouterRecord>(
    name: string,
    router: SwiftTRPCRouter<TRecord>
): {
    router: string;
    models: Set<string>;
} => {
    let nestedStructure: NestedStructure = {};
    const models = new Set<string>();

    Object.entries(router._def.procedures).forEach(([key, procedure]) => {
        addToNestedStructure(key, procedure as AnyProcedure, nestedStructure);
    });

    let extra = "";
    extra += "init(baseUrl newBaseUrl: URL) {\n";
    extra += "baseUrl = newBaseUrl\n";
    extra += "}\n";

    nestedStructure = { [name]: nestedStructure };
    const result = generateSwiftRouter(name, "", nestedStructure[name] as NestedStructure, models, extra);

    const resultLines = result.router.split("\n");
    resultLines.splice(1, 0, result.models);

    const joinedResult = resultLines.join("\n");

    return {
        router: joinedResult,
        models,
    };
};

/**
 * Generates a Swift client router class from the given tRPC router
 * @param router The tRPC router to generate a client for
 */
export const generateSwiftRouter = (
    name: string,
    fullPath: string,
    structure: NestedStructure,
    existingModels: Set<string>,
    extra?: string
): {
    router: string;
    models: string;
} => {
    let routerCode = `class ${capitalizeFirstLetter(name)} {\n`;
    let modelCode = "";

    if (extra) {
        routerCode += extra + "\n";
    } else {
        routerCode += `let fullPath = "${fullPath}"\n\n`;
    }

    Object.entries(structure).forEach(([key, value]) => {
        if ("_def" in value) {
            const result = generateSwiftProcedure(key, value as AnyProcedure, !fullPath, existingModels);
            routerCode += result.procedure + "\n";
            modelCode += result.globalModels;
        } else {
            const result = generateSwiftRouter(key, (fullPath ? name + "." : "") + key, value as NestedStructure, existingModels);
            routerCode += result.router + "\n";
            modelCode += result.models + "\n";
        }
    });
    routerCode += "}\n";
    return {
        router: routerCode,
        models: modelCode,
    };
};

/**
 * Generates a Swift client procedure method from the given tRPC procedure
 * @param procedure The tRPC procedure to generate a client method for
 */
export const generateSwiftProcedure = <TProcedure extends AnyProcedure>(
    name: string,
    procedure: TProcedure,
    rootPath: boolean,
    existingModels: Set<string>
): {
    procedure: string;
    globalModels: string;
} => {
    let globalModels = "";
    let models = "";
    let res = `func ${name}(`;

    if (procedure._def.inputs?.length > 0) {
        let inputName = "";
        const schema: AnyZodObject = procedure._def.inputs[0];
        if (schema._def.swift?.name) {
            inputName = schema._def.swift.name;
            if (!existingModels.has(inputName)) {
                globalModels += generateSwiftModel(inputName, schema);
                existingModels.add(inputName);
            }
        } else {
            inputName = `${capitalizeFirstLetter(name)}Input`;
            const input = generateSwiftModel(inputName, schema);
            models += input + "\n";
        }

        res += `input: ${inputName}`;
    }

    res += ") async throws";

    if (procedure._def.output) {
        const outputName = `${capitalizeFirstLetter(name)}Output`;
        let outputValueName = outputName;

        let outputModel = procedure._def.output;
        if (procedure._def.output instanceof ZodOptional || procedure._def.output instanceof ZodNullable) {
            outputModel = procedure._def.output._def.innerType;
            outputValueName = `${outputName}?`;
        } else if (procedure._def.output instanceof ZodArray) {
            outputModel = procedure._def.output._def.type;
            outputValueName = `[${outputName}]`;
        }

        const output = generateSwiftModel(outputName, outputModel);
        models += output + "\n";
        res += ` -> ${outputValueName}`;
    }

    const pathVal = rootPath ? `"${name}"` : `fullPath + ".${name}"`;

    res += " {\n";
    if (procedure._def.query) {
        res += `return try await TRPCClient.shared.sendQuery(url: baseUrl.appendingPathComponent(${pathVal}), input: input)\n`;
    } else if (procedure._def.mutation) {
        res += `return try await TRPCClient.shared.sendMutation(url: baseUrl.appendingPathComponent(${pathVal}), input: input)\n`;
    }
    res += "}\n";
    return {
        procedure: models + res,
        globalModels,
    };
};

/**
 * Generate a Swift model class from the given Zod schema
 */
export const generateSwiftModel = (name: string, schema: AnyZodObject): string => {
    let res = `struct ${capitalizeFirstLetter(name)}: Equatable, Codable {\n`;
    Object.entries(schema.shape).forEach(([key, value]) => {
        const generatedType = generateSwiftType(key, value as ZodAny);
        if (generatedType.model) {
            res += generatedType.model + "\n";
        }
        res += `let ${key}: ${generatedType.type}\n`;
    });
    res += "}\n";
    return res;
};

/**
 * Generate a Swift type from the given Zod schema
 */
export const generateSwiftType = (
    key: string,
    schema: ZodTypeAny
): {
    model?: string;
    type: string;
} => {
    if (schema instanceof ZodObject) {
        return { model: generateSwiftModel(key + "Type", schema), type: capitalizeFirstLetter(key) + "Type" };
    } else if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
        const generated = generateSwiftType(key, schema._def.innerType);
        return {
            model: generated.model,
            type: generated.type + "?",
        };
    } else if (schema instanceof ZodArray) {
        const generated = generateSwiftType(key, schema._def.type);
        return {
            model: generated.model,
            type: "[" + generated.type + "]",
        };
    } else {
        if ("typeName" in schema._def) {
            switch (schema._def.typeName as ZodFirstPartyTypeKind) {
                case ZodFirstPartyTypeKind.ZodString:
                    return { type: "String" };
                case ZodFirstPartyTypeKind.ZodBigInt:
                case ZodFirstPartyTypeKind.ZodNumber:
                    return { type: "Int" };
                case ZodFirstPartyTypeKind.ZodBoolean:
                    return { type: "Bool" };
                case ZodFirstPartyTypeKind.ZodDate:
                    return { type: "Date" };
                default:
                    return { type: "Any" };
            }
        }
        throw new Error("Unknown type");
    }
};

/**
 * Adds indentation to the given Swift code string
 */
export const indent = (code: string): string => {
    const lines = code.split("\n");
    let indentationLevel = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("}")) {
            indentationLevel--;
        }
        for (let j = 0; j < indentationLevel; j++) {
            lines[i] = "    " + lines[i];
        }
        if (lines[i].includes("{")) {
            indentationLevel++;
        }
    }

    return lines.join("\n");
};

const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

const addToNestedStructure = (key: string, procedure: AnyProcedure, structure: NestedStructure) => {
    const parentRouters = key.split(".").slice(0, -1);
    const procedureName = key.split(".").slice(-1)[0];

    let currentObject = structure;
    parentRouters.forEach((routerName) => {
        if (currentObject[routerName] === undefined) {
            currentObject[routerName] = {};
        }
        currentObject = currentObject[routerName] as NestedObject;
    });

    currentObject[procedureName] = procedure;
};

const generated = generateSwiftAppRouter("AppClient", appRouter);
let code = generated.router;

generated.models.forEach((model) => {
    code = `typealias ${model} = AppClient.${model}\n\n${code}`;
});

const formatted = indent(code);
writeFileSync("../ios/trpc-swift-demo/trpc-swift-demo/Models/App.swift", "import Foundation\n\nvar baseUrl: URL!\n\n" + formatted);
