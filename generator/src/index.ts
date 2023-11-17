import { appRouter } from "./demo/routes/router.js";
import { writeFileSync } from "fs";
import { SwiftTRPCRouter } from "./types.js";
import { getTRPCStructure, trpcStructureToSwiftClass } from "./generators/router.js";
import { indentSwiftCode } from "./utility.js";

export const trpcRouterToSwiftClient = (name: string, router: SwiftTRPCRouter): string => {
    const trpcStructure = getTRPCStructure(router);
    const swiftClass = trpcStructureToSwiftClass(name, trpcStructure, { isRoot: true });

    let swiftClient = "import Foundation \n\n";
    swiftClient += swiftClass;
    return indentSwiftCode(swiftClient);
};

const generated = trpcRouterToSwiftClient("AppClient", appRouter);
writeFileSync("../ios/trpc-swift-demo/trpc-swift-demo/Models/App.swift", generated);
