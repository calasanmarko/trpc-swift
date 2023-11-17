// import "./demo/express.js";
// import { appRouter } from "./demo/routes/router.js";
import { writeFileSync } from "fs";
import { getTRPCStructure, trpcStructureToSwiftClass } from "./generators/router.js";
import { indentSwiftCode } from "./utility.js";
import { SwiftTRPCRouterDef } from "./types.js";

export { extendZodWithSwift } from "./types.js";

export const trpcRouterToSwiftClient = (name: string, routerDef: SwiftTRPCRouterDef): string => {
    const trpcStructure = getTRPCStructure(routerDef);
    const swiftClass = trpcStructureToSwiftClass(name, trpcStructure, { isRoot: true, depth: 0 });

    let swiftClient = "import Foundation \n\n";
    swiftClient += swiftClass;
    return indentSwiftCode(swiftClient);
};

export const trpcRouterToSwiftFile = (name: string, routerDef: SwiftTRPCRouterDef, outFile: string) => {
    const generated = trpcRouterToSwiftClient(name, routerDef);
    writeFileSync(outFile, generated);
};

// trpcRouterToSwiftFile("AppClient", appRouter._def, "../ios/trpc-swift-demo/trpc-swift-demo/Models/App.swift");
