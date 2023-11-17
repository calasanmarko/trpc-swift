#!/usr/bin/env node
import { writeFileSync } from "fs";
import { trpcRouterToSwiftClient } from "./index.js";
import path from "path";

const timerLabel = "Done in";
console.time(timerLabel);

const args = process.argv.slice(2);

if (args.length < 2) {
    console.error("Usage: trpc-swift -n [routerName] -i [routerPath] -o [outputPath]");
    process.exit(1);
}

const options = {
    routerName: "",
    routerPath: "",
    outputPath: "",
};

for (let i = 0; i < args.length; i += 2) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
        case "-n":
            options.routerName = value;
            break;
        case "-i":
            options.routerPath = value;
            break;
        case "-o":
            options.outputPath = value;
            break;
        default:
            console.error(`Unknown argument: ${arg}`);
            process.exit(1);
    }
}

if (!options.routerName || !options.routerPath || !options.outputPath) {
    console.error("All parameters (routerName, routerPath, outputPath) are required.");
    process.exit(1);
}

console.log(options.routerPath);
const module = await import(path.join(process.cwd(), "../../payroll/api/debug/routes/router.js"));
const router = module[options.routerName];
if (!router) {
    console.error(`Could not find router ${options.routerName} in ${options.routerPath}`);
    process.exit(1);
}

const generatedCode = trpcRouterToSwiftClient(options.routerName, router);
writeFileSync(options.outputPath, generatedCode);

console.log(`Generated TRPC Swift client for ${options.routerName} in ${options.outputPath}`);
console.timeEnd(timerLabel);
