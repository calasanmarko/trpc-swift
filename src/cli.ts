#!/usr/bin/env node
import { writeFileSync } from "fs";
import { trpcRouterToSwiftClient } from "./index.js";
import { TRPCSwiftFlags } from "./types.js";
import path from "path";
import os from "os";

const timerLabel = "Done in";
console.time(timerLabel);

const args = process.argv.slice(2);

const showHelp = () => {
    console.log("Usage: trpc-swift -r [routerName] -i [routerPath] -o [outputPath]");
    console.log("Options:");
    console.log("  -r, --router-name  Set the router name that should be found in the input file");
    console.log("  -i, --input        Set the path where the tRPC input tRPC router is located");
    console.log("  -o, --output       Set the output path for the generated Swift client");
    console.log("  -c  --conformance  Set the conformance for the generated Swift models (default: Equatable)");
    console.log("  -g, --global-mode  Control which models are placed by default in the global scope.");
    console.log("      all            All named models will be placed in the global scope by default.");
    console.log("      top            Only named models directly referenced by routes will be placed in the global scope by default.");
    console.log("      none           No models will be placed in the global scope by default.");
    console.log("  -a, --alias        Create public type aliases for all models in the global scope.");
    console.log("  -s, --shared       Create a shared singleton instance of the generated Swift client.");
    console.log("  -h, --help         Display this help message");
    console.log("  -q, --quiet        Run in quiet mode (no output except for fatal errors)");
};

if (args.length < 2) {
    console.error("Usage: trpc-swift -n [routerName] -i [routerPath] -o [outputPath]");
    process.exit(1);
}

const flags: TRPCSwiftFlags = {
    createTypeAliases: false,
    createShared: false,
    globalMode: "top",
    conformance: "Equatable",
    quiet: false,
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
        case "--help":
        case "-h":
            showHelp();
            process.exit(0);
        // eslint-disable-next-line no-fallthrough
        case "--quiet":
        case "-q":
            flags.quiet = true;
            break;
        case "--router-name":
        case "-r":
            options.routerName = value!;
            i++;
            break;
        case "--input":
        case "-i":
            options.routerPath = value!;
            i++;
            break;
        case "--output":
        case "-o":
            options.outputPath = value!;
            i++;
            break;
        case "--global-mode":
        case "-g":
            switch (value) {
                case "all":
                case "top":
                case "none":
                    flags.globalMode = value;
                    break;
                default:
                    console.error(`Unknown global mode: ${value}`);
                    console.log();
                    showHelp();
                    process.exit(1);
            }
            i++;
            break;
        case "--conformance":
        case "-c":
            flags.conformance = value!.replace(/['"]/g, "").replace(/,(?!\s)/g, ", ");
            i++;
            break;
        case "--alias":
        case "-a":
            flags.createTypeAliases = true;
            break;
        case "--shared":
        case "-s":
            flags.createShared = true;
            break;
        default:
            console.error(`Unknown argument: ${arg}`);
            console.log();
            showHelp();
            process.exit(1);
    }
}

if (!options.routerName || !options.routerPath || !options.outputPath) {
    console.error("--router-name, --router-path, --outputh-path are required.");
    console.log();
    showHelp();
    process.exit(1);
}

let fullRouterPath = path.join(process.cwd(), options.routerPath);
if (os.platform() === "win32") {
    fullRouterPath = "file:///" + fullRouterPath;
}

const module = await import(fullRouterPath);
const router = module[options.routerName];
if (!router) {
    console.error(`Could not find router ${options.routerName} in ${options.routerPath}`);
    process.exit(1);
}

const generatedCode = trpcRouterToSwiftClient(options.routerName, router._def, flags);
writeFileSync(options.outputPath, generatedCode);

if (!flags.quiet) {
    console.log(`Generated TRPC Swift client for ${options.routerName} in ${options.outputPath}`);
    console.timeEnd(timerLabel);
}
