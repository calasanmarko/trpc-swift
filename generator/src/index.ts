import { AnyRouter, type ProcedureRouterRecord, type Router } from "@trpc/server";
import type { RouterDef } from "../node_modules/@trpc/server/src/core/router";
import type { AnyProcedure, RootConfig } from "@trpc/server";
import { appRouter } from "trpc-swift-demo";
import { writeFileSync } from "fs";

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

export const generateSwiftAppRouter = <TRecord extends ProcedureRouterRecord>(name: string, router: SwiftTRPCRouter<TRecord>): string => {
    let nestedStructure: NestedStructure = {};

    Object.entries(router._def.procedures).forEach(([key, procedure]) => {
        addToNestedStructure(key, procedure as AnyProcedure, nestedStructure);
    });

    nestedStructure = { [name]: nestedStructure };
    return generateSwiftRouter(name, nestedStructure[name] as NestedStructure);
};

/**
 * Generates a Swift client router class from the given tRPC router
 * @param router The tRPC router to generate a client for
 */
export const generateSwiftRouter = (name: string, structure: NestedStructure): string => {
    let res = `class ${name} {\n`;
    Object.entries(structure).forEach(([key, value]) => {
        if ("_def" in value) {
            res += generateSwiftProcedure(key, value as AnyProcedure);
        } else {
            res += generateSwiftRouter(key, value as NestedStructure);
        }
    });
    res += "}\n";
    return res;
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

/**
 * Generates a Swift client procedure method from the given tRPC procedure
 * @param procedure The tRPC procedure to generate a client method for
 */
export const generateSwiftProcedure = <TProcedure extends AnyProcedure>(name: string, procedure: TProcedure): string => {
    let res = `func ${name}(`;

    res += ")\n{\n}\n";
    return res;
};

const generated = generateSwiftAppRouter("App", appRouter);
writeFileSync("./out/App.swift", generated);
