#!/usr/bin/env bun

import { TRPCSwift } from ".";
import path from "path";

const cwd = process.cwd();
const configPath = path.join(cwd, "trpc-swift.ts");

console.log(`Generating Swift code from trpc-swift config at ${configPath}`);
console.log();

const config = await import(configPath).then((m) => m.default);

const timeMessage = `Generated Swift code at ${config.outFile}`;
console.time(timeMessage);

const result = await new TRPCSwift(config).root();
if (config.outFile) {
    await Bun.write(config.outFile, result);
} else {
    console.log(result);
}

console.timeEnd(timeMessage);

export {};
