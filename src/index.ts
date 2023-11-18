import { readFileSync, writeFileSync } from "fs";
import { getTRPCStructure, trpcStructureToSwiftClass } from "./generators/router.js";
import { indentSwiftCode, processTypeName } from "./utility.js";
import { SwiftModelGenerationData, SwiftTRPCRouterDef } from "./types.js";
import path from "path";
import { fileURLToPath } from "url";

export { extendZodWithSwift } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const trpcRouterToSwiftClient = (name: string, routerDef: SwiftTRPCRouterDef, createTypeAliases: boolean): string => {
    const trpcStructure = getTRPCStructure(routerDef);
    const globalModels: SwiftModelGenerationData = {
        swiftCode: "",
        names: new Set<string>(),
    };
    const swiftClass = trpcStructureToSwiftClass(name, trpcStructure, 0, globalModels);

    let swiftClient = readFileSync(path.join(__dirname, "templates/TRPCClient.swift")).toString("utf-8");
    swiftClient += swiftClass;

    if (createTypeAliases) {
        globalModels.names.forEach((modelName) => {
            swiftClient += `typealias ${modelName} = ${processTypeName(name)}.${modelName}\n`;
        });
    }

    return indentSwiftCode(swiftClient);
};

export const trpcRouterToSwiftFile = (name: string, routerDef: SwiftTRPCRouterDef, createTypeAliases: boolean, outFile: string) => {
    const generated = trpcRouterToSwiftClient(name, routerDef, createTypeAliases);
    writeFileSync(outFile, generated);
};
