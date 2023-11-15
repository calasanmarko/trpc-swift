"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSwiftProcedure = exports.generateSwiftRouter = exports.generateSwiftAppRouter = void 0;
const trpc_swift_demo_1 = require("trpc-swift-demo");
const fs_1 = require("fs");
const generateSwiftAppRouter = (name, router) => {
    let nestedStructure = {};
    Object.entries(router._def.procedures).forEach(([key, procedure]) => {
        addToNestedStructure(key, procedure, nestedStructure);
    });
    nestedStructure = { [name]: nestedStructure };
    return (0, exports.generateSwiftRouter)(name, nestedStructure[name]);
};
exports.generateSwiftAppRouter = generateSwiftAppRouter;
/**
 * Generates a Swift client router class from the given tRPC router
 * @param router The tRPC router to generate a client for
 */
const generateSwiftRouter = (name, structure) => {
    let res = `class ${name} {\n`;
    Object.entries(structure).forEach(([key, value]) => {
        if ("_def" in value) {
            res += (0, exports.generateSwiftProcedure)(key, value);
        }
        else {
            res += (0, exports.generateSwiftRouter)(key, value);
        }
    });
    res += "}\n";
    return res;
};
exports.generateSwiftRouter = generateSwiftRouter;
const addToNestedStructure = (key, procedure, structure) => {
    const parentRouters = key.split(".").slice(0, -1);
    const procedureName = key.split(".").slice(-1)[0];
    let currentObject = structure;
    parentRouters.forEach((routerName) => {
        if (currentObject[routerName] === undefined) {
            currentObject[routerName] = {};
        }
        currentObject = currentObject[routerName];
    });
    currentObject[procedureName] = procedure;
};
/**
 * Generates a Swift client procedure method from the given tRPC procedure
 * @param procedure The tRPC procedure to generate a client method for
 */
const generateSwiftProcedure = (name, procedure) => {
    let res = `func ${name}(`;
    res += ")\n{\n}\n";
    return res;
};
exports.generateSwiftProcedure = generateSwiftProcedure;
const generated = (0, exports.generateSwiftAppRouter)("App", trpc_swift_demo_1.appRouter);
(0, fs_1.writeFileSync)("./out/App.swift", generated);
//# sourceMappingURL=index.js.map