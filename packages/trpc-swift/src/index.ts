import { AnyRouter, ProcedureBuilder } from "@trpc/server";
import { z, ZodFirstPartyTypeKind } from "zod";
import SampleConfig from "trpc-swift-sample/trpc-swift";
import { indent, swiftTypeName } from "./format";

export class Swift {
    static async root(appRouter: AnyRouter): Promise<string> {
        let procedureCode = "";
        for (const [name, procedure] of Object.entries(appRouter._def.procedures)) {
            procedureCode += this.procedure({
                procedure: procedure as ProcedureBuilder<never>,
                name,
                scope: new Set(),
            });
        }
        return indent(`
            ${await Bun.file("../templates/TRPCClient.swift").text()}
            class AppRouter {
                var url: URL
                var middlewares: [TRPCMiddleware]

                init(url: URL, middlewares: [TRPCMiddleware] = []) {
                    self.url = url
                    self.middlewares = middlewares
                }

                ${procedureCode}
            }`);
    }

    static procedure({
        procedure,
        name,
        scope,
    }: {
        procedure: ProcedureBuilder<never>;
        name: string;
        scope: Set<z.ZodTypeAny>;
    }): string {
        const input = procedure._def.inputs.at(0) as z.ZodTypeAny | undefined;
        const output = procedure._def.output as z.ZodTypeAny | undefined;

        let inputType = "";
        let outputType = "";
        let result = "";
        if (input) {
            const data = this.zodPrimitive({ type: input, name: `${name}Input`, scope });
            if (data) {
                inputType = data.name;
                if (data.definition) {
                    result += `${data.definition}\n\n`;
                }
            }
        }

        if (output) {
            const data = this.zodPrimitive({ type: output, name: `${name}Output`, scope });
            if (data) {
                outputType = data.name;
                if (data.definition) {
                    result += `${data.definition}\n\n`;
                }
            }
        }

        result += `func ${name}(${inputType ? `input: ${inputType}` : ""}) async throws -> ${outputType || "TRPCClient.EmptyObject"} {
            return try await TRPCClient.sendQuery(url: url.appendingPathComponent("${name}"), middlewares: middlewares, input: ${inputType ? "input" : "TRPCClient.EmptyObject()"})
        }\n\n`;
        return result;
    }

    static zodPrimitive({
        type,
        name,
        scope,
    }: {
        type: z.ZodTypeAny;
        name: string;
        scope: Set<z.ZodTypeAny>;
    }): { name: string; definition?: string } | null {
        name = swiftTypeName({ name, type });

        const wrapped = (strings: TemplateStringsArray, ...params: z.ZodTypeAny[]) => {
            let innerType = params[0];
            if (type instanceof z.ZodOptional || type instanceof z.ZodNullable) {
                while (innerType instanceof z.ZodOptional || innerType instanceof z.ZodNullable) {
                    innerType = innerType.unwrap();
                }
            }

            const innerResult = this.zodPrimitive({
                type: innerType,
                name,
                scope,
            });

            if (innerResult === null) {
                return null;
            }

            return {
                name: `${strings[0]}${innerResult.name}${strings[1]}`,
                definition: innerResult.definition,
            };
        };

        switch (type._def.typeName) {
            case ZodFirstPartyTypeKind.ZodString:
                return { name: "String" };
            case ZodFirstPartyTypeKind.ZodNumber:
                return { name: (type as z.ZodNumber).isInt ? "Int" : "Float" };
            case ZodFirstPartyTypeKind.ZodBigInt:
                return { name: "Int" };
            case ZodFirstPartyTypeKind.ZodBoolean:
                return { name: "Bool" };
            case ZodFirstPartyTypeKind.ZodDate:
                return { name: "Date" };
            case ZodFirstPartyTypeKind.ZodSymbol:
                return { name: "String" };
            case ZodFirstPartyTypeKind.ZodOptional:
                return wrapped`${type}?`;
            case ZodFirstPartyTypeKind.ZodNullable:
                return wrapped`${type}?`;
            case ZodFirstPartyTypeKind.ZodArray:
                return wrapped`[${(type as z.ZodArray<z.ZodTypeAny>)._def.type}]`;
            case ZodFirstPartyTypeKind.ZodRecord:
                return wrapped`[String: ${(type as z.ZodRecord)._def.valueType}]`;
            case ZodFirstPartyTypeKind.ZodMap:
                return wrapped`[String: ${(type as z.ZodMap)._def.valueType}>]`;
            case ZodFirstPartyTypeKind.ZodSet:
                return wrapped`Set<${(type as z.ZodSet)._def.valueType}>`;
            case ZodFirstPartyTypeKind.ZodEffects:
                return wrapped`${(type as z.ZodEffects<never, never>)._def.schema}`;
            case ZodFirstPartyTypeKind.ZodDefault:
                return wrapped`${(type as z.ZodDefault<never>)._def.innerType}`;
            case ZodFirstPartyTypeKind.ZodCatch:
                return wrapped`${(type as z.ZodCatch<never>)._def.innerType}`;
            case ZodFirstPartyTypeKind.ZodBranded:
                return wrapped`${(type as z.ZodBranded<never, never>).unwrap()}`;
            case ZodFirstPartyTypeKind.ZodReadonly:
                return wrapped`${(type as z.ZodReadonly<never>).unwrap()}`;
            case ZodFirstPartyTypeKind.ZodLazy:
                return wrapped`${(type as z.ZodLazy<never>)._def.getter()}`;
            case ZodFirstPartyTypeKind.ZodPromise:
                return wrapped`${(type as z.ZodPromise<never>)._def.type}`;
            case ZodFirstPartyTypeKind.ZodPipeline:
                return wrapped`${(type as z.ZodPipeline<z.ZodNever, never>)._def.in}`;
            case ZodFirstPartyTypeKind.ZodAny:
                return { name: "Any" };
            case ZodFirstPartyTypeKind.ZodUnknown:
                return { name: "Any" };
            case ZodFirstPartyTypeKind.ZodNaN:
                return null;
            case ZodFirstPartyTypeKind.ZodNull:
                return null;
            case ZodFirstPartyTypeKind.ZodVoid:
                return null;
            case ZodFirstPartyTypeKind.ZodNever:
                return null;
            case ZodFirstPartyTypeKind.ZodUndefined:
                return null;
            case ZodFirstPartyTypeKind.ZodObject:
                if (scope.has(type)) {
                    return { name };
                }
                scope.add(type);
                return this.structure({
                    properties: (type as z.ZodObject<Record<string, z.ZodTypeAny>>).shape,
                    name,
                    scope: new Set(scope),
                });
            case ZodFirstPartyTypeKind.ZodEnum:
                if (scope.has(type)) {
                    return { name };
                }
                scope.add(type);
                return this.enumeration({
                    values: (type as z.ZodEnum<never>)._def.values,
                    name,
                });
            case ZodFirstPartyTypeKind.ZodLiteral:
                if (scope.has(type)) {
                    return { name };
                }
                scope.add(type);
                return this.enumeration({
                    values: [(type as z.ZodLiteral<never>)._def.value],
                    name,
                });
            case ZodFirstPartyTypeKind.ZodUnion:
                if (scope.has(type)) {
                    return { name };
                }
                scope.add(type);
                return this.union({
                    types: (type as z.ZodUnion<never>)._def.options,
                    name,
                    scope: new Set(scope),
                });
        }

        throw new Error(`Unsupported type: ${type._def.typeName}`);
    }

    static enumeration({ values, name }: { values: (string | number)[]; name: string }) {
        let isValid = false;
        let definition = `enum ${name}: String, Codable, Equatable {\n`;
        for (const value of values) {
            if (typeof value === "string" || typeof value === "number") {
                definition += `case ${value}\n`;
                isValid = true;
            }
        }
        definition += "}";
        return isValid ? { name, definition } : null;
    }

    static structure({
        properties,
        name,
        scope,
    }: {
        properties: Record<string, z.ZodTypeAny>;
        name: string;
        scope: Set<z.ZodTypeAny>;
    }) {
        let definitions = "";
        let swiftProperties = "";
        const constructorArguments: string[] = [];
        const constructorAssignments: string[] = [];
        for (const [key, value] of Object.entries(properties)) {
            try {
                const result = this.zodPrimitive({ type: value, name: key, scope });
                if (result) {
                    if (result.definition) {
                        definitions += `${result.definition}\n`;
                    }
                    swiftProperties += `var ${key}: ${result.name}\n`;
                    constructorArguments.push(`${key}: ${result.name}${result.name.endsWith("?") ? " = nil" : ""}`);
                    constructorAssignments.push(`self.${key} = ${key}`);
                }
            } catch (e) {
                console.error(e);
            }
        }

        let constructor = `init(${constructorArguments.join(", ")}) {\n`;
        constructor += `${constructorAssignments.join("\n")}\n`;
        constructor += "}";

        let definition = `struct ${name}: Codable, Equatable {\n`;
        if (definitions) {
            definition += `${definitions}\n`;
        }
        if (swiftProperties) {
            definition += `${swiftProperties}\n`;
        }
        definition += constructor;
        definition += "\n}";

        return { name, definition };
    }

    static union({ types, name, scope }: { types: z.ZodTypeAny[]; name: string; scope: Set<z.ZodTypeAny> }) {
        return this.structure({
            properties: types.reduce(
                (acc, type, index) => {
                    acc[`type${index}`] = type;
                    return acc;
                },
                {} as Record<string, z.ZodTypeAny>
            ),
            name,
            scope,
        });
    }
}

const swift = await Swift.root(SampleConfig.router);
await Bun.write("/Users/marko/source/WebSocketTest/WebSocketTest/Test.swift", swift);
