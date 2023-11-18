#!/usr/bin/env node
import { writeFileSync } from "fs";
import { trpcRouterToSwiftClient } from "./index.js";
import path from "path";
import { TRPCSwiftFlags } from "./types.js";

const timerLabel = "Done in";
console.time(timerLabel);

const args = process.argv.slice(2);

if (args.length < 2) {
    console.error("Usage: trpc-swift -n [routerName] -i [routerPath] -o [outputPath]");
    process.exit(1);
}

const flags: TRPCSwiftFlags = {
    createTypeAliases: false,
    createShared: false,
};

const options = {
    routerName: "",
    routerPath: "",
    outputPath: "",
    flags,
};

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args.at(i + 1);

    switch (arg) {
        case "-n":
            options.routerName = value!;
            i++;
            break;
        case "-i":
            options.routerPath = value!;
            i++;
            break;
        case "-o":
            options.outputPath = value!;
            i++;
            break;
        case "-a":
            flags.createTypeAliases = true;
            break;
        case "-s":
            flags.createShared = true;
            break;
        default:
            console.error(`Unknown argument: ${arg}`);
            process.exit(1);
    }
}

if (!options.routerName || !options.routerPath || !options.outputPath) {
    console.error("routerName, routerPath, outputPath are required.");
    process.exit(1);
}

const module = await import(path.join(process.cwd(), options.routerPath));
const router = module[options.routerName];
if (!router) {
    console.error(`Could not find router ${options.routerName} in ${options.routerPath}`);
    process.exit(1);
}

const generatedCode = trpcRouterToSwiftClient(options.routerName, router._def, flags);
writeFileSync(options.outputPath, generatedCode);

console.log(`Generated TRPC Swift client for ${options.routerName} in ${options.outputPath}`);
console.timeEnd(timerLabel);
