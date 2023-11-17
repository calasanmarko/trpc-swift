import { readFileSync, writeFileSync } from "fs";
import { getTRPCStructure, trpcStructureToSwiftClass } from "./generators/router.js";
import { indentSwiftCode } from "./utility.js";
import { SwiftTRPCRouterDef } from "./types.js";
import path from "path";
import { fileURLToPath } from "url";

export { extendZodWithSwift } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const trpcRouterToSwiftClient = (name: string, routerDef: SwiftTRPCRouterDef): string => {
    const trpcStructure = getTRPCStructure(routerDef);
    const swiftClass = trpcStructureToSwiftClass(name, trpcStructure, { isRoot: true, depth: 0 });

    let swiftClient = readFileSync(path.join(__dirname, "templates/TRPCClient.swift")).toString("utf-8");
    swiftClient += swiftClass;
    return indentSwiftCode(swiftClient);
};

export const trpcRouterToSwiftFile = (name: string, routerDef: SwiftTRPCRouterDef, outFile: string) => {
    const generated = trpcRouterToSwiftClient(name, routerDef);
    writeFileSync(outFile, generated);
};
