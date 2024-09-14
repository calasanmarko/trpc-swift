import type { TRPCSwiftConfiguration } from "trpc-swift";
import { appRouter } from "./src/router";

export default {
    router: appRouter,
    outFile: "../trpc-swift/output/Test.swift",
} satisfies TRPCSwiftConfiguration;
