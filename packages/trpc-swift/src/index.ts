import { z, ZodFirstPartyTypeKind } from "zod";
import SampleConfig from "trpc-swift-sample/trpc-swift";
import { indent, swiftTypeName, swiftZodTypeName } from "./format";
import { TRPCChildRouter, TRPCProcedureWithInput, TRPCSwiftConfiguration } from "./types";

export class TRPCSwift {
    globalDefinitions: string[] = [];
    globalScope: Set<z.ZodTypeAny> = new Set();
    config: TRPCSwiftConfiguration;

    constructor(config: Partial<TRPCSwiftConfiguration> & Pick<TRPCSwiftConfiguration, "router">) {
        this.config = {
            permissionScope: "internal",
            models: {
                defaultGlobals: "named",
            },
            ...config,
        };
    }

    async root(): Promise<string> {
        const routerCode = this.router({
            router: this.config.router._def.procedures,
            name: "AppRouter",
            scope: new Set(),
            routerDepth: 0,
        });

        const result = `
            ${await Bun.file("../templates/TRPCClient.swift").text()}
            ${this.globalDefinitions.join("\n\n")}
            ${routerCode}
        `;

        return indent(result);
    }

    router({
        router,
        name,
        scope,
        routerDepth,
    }: {
        router: TRPCChildRouter;
        name: string;
        scope: Set<z.ZodTypeAny>;
        routerDepth: number;
    }) {
        const childRouters: Record<string, TRPCChildRouter> = {};

        let code = "";
        for (const [name, procedure] of Object.entries(router)) {
            const nameParts = name.split(".");
            const slicedName = nameParts.slice(1).join(".");

            if (nameParts.length > 1) {
                childRouters[nameParts[0]] ||= {};
                childRouters[nameParts[0]][slicedName] = procedure;
            } else {
                code += this.procedure({
                    procedure,
                    name,
                    scope,
                    routerDepth,
                });
            }
        }

        for (const [name, childRouter] of Object.entries(childRouters)) {
            code += `${this.permissionPrefix()}lazy var ${name} = ${swiftTypeName({ name })}(url: url.appendingPathComponent("${name}"), middlewares: middlewares)\n`;
            code += this.router({
                router: childRouter,
                name,
                scope,
                routerDepth: routerDepth + 1,
            });
        }

        const result = `
        ${this.permissionPrefix()}class ${swiftTypeName({ name })} {
            fileprivate var url: URL
            fileprivate var middlewares: [TRPCMiddleware]

            ${this.permissionPrefix()}init(url: URL, middlewares: [TRPCMiddleware] = []) {
                self.url = url
                self.middlewares = middlewares
            }

            ${code}
        }
        `;

        return result;
    }

    procedure({
        procedure,
        name,
        scope,
        routerDepth,
    }: {
        procedure: TRPCProcedureWithInput;
        name: string;
        scope: Set<z.ZodTypeAny>;
        routerDepth: number;
    }): string {
        const input = procedure._def.inputs.at(0);
        const output = procedure._def.output;

        if (input !== undefined && !(input instanceof z.ZodType)) {
            throw new Error(`Procedure ${name} has non-Zod input`);
        }

        if (output !== undefined && !(output instanceof z.ZodType)) {
            throw new Error(`Procedure ${name} has non-Zod output`);
        }

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

        const appendFunction = routerDepth > 0 ? "appendingPathExtension" : "appendingPathComponent";
        const emptyObjectType = `TRPCClient.EmptyObject`;

        const procedureMethod = procedure._def.type === "query" ? "sendQuery" : "sendMutation";

        result += `${this.permissionPrefix()}func ${name}(${inputType ? `input: ${inputType}` : ""}) async throws -> ${outputType || "Void"} {
            ${outputType ? "return" : `let _: ${emptyObjectType} =`} try await TRPCClient.${procedureMethod}(url: url.${appendFunction}("${name}"), middlewares: middlewares, input: ${inputType ? "input" : `${emptyObjectType}()`})
        }\n\n`;
        return result;
    }

    zodPrimitive({
        type,
        name,
        scope,
    }: {
        type: z.ZodTypeAny;
        name: string;
        scope: Set<z.ZodTypeAny>;
    }): { name: string; definition?: string } | null {
        name = swiftZodTypeName({ name, type });

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

        const result = (() => {
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
        })();

        if (
            result &&
            "definition" in result &&
            result.definition &&
            (type._def.swift?.global || (type._def.swift?.name && this.config.models.defaultGlobals === "named"))
        ) {
            if (!this.globalScope.has(type)) {
                this.globalDefinitions.push(result.definition);
            }
            this.globalScope.add(type);
            result.definition = undefined;
        }

        return result;
    }

    enumeration({ values, name }: { values: (string | number)[]; name: string }) {
        let isValid = false;
        let definition = `${this.permissionPrefix()}enum ${name}: String, Codable, Equatable {\n`;
        for (const value of values) {
            if (typeof value === "string" || typeof value === "number") {
                definition += `case ${value}\n`;
                isValid = true;
            }
        }
        definition += "}";
        return isValid ? { name, definition } : null;
    }

    structure({
        properties,
        name,
        scope,
        isUnion,
    }: {
        properties: Record<string, z.ZodTypeAny>;
        name: string;
        scope: Set<z.ZodTypeAny>;
        isUnion?: boolean;
    }) {
        let definitions = "";
        let swiftProperties = "";
        const propertiesToTypeNames: Record<string, string> = {};
        for (const [key, value] of Object.entries(properties)) {
            try {
                const result = this.zodPrimitive({ type: value, name: key, scope });
                if (result) {
                    if (result.definition && !this.globalScope.has(value)) {
                        definitions += `${result.definition}\n`;
                    }

                    const forceOptional = isUnion && !result.name.endsWith("?");
                    swiftProperties += `${this.permissionPrefix()}var ${key}: ${result.name}${forceOptional ? "?" : ""}\n`;
                    propertiesToTypeNames[key] = result.name;
                }
            } catch (e) {
                console.error(e);
            }
        }

        const { initializers, encoder, decoder } = (() => {
            if (isUnion) {
                const initializers = Object.entries(propertiesToTypeNames).map(([property, typeName]) =>
                    this.swiftInitializer({
                        propertiesToTypeNames: { [property]: typeName },
                    })
                );

                const encoder = `${this.permissionPrefix()}func encode(to encoder: Encoder) throws {
                    ${Object.keys(propertiesToTypeNames)
                        .map(
                            (property) => `if let ${property} = ${property} {
                                try ${property}.encode(to: encoder)
                                return
                            }`
                        )
                        .join("\n\n")}
                    }`;

                const decoder = `${this.permissionPrefix()}init(from decoder: Decoder) throws {
                    ${Object.entries(propertiesToTypeNames)
                        .map(([property, typeName]) => `self.${property} = try? ${typeName}(from: decoder)`)
                        .join("\n")}
                    }`;

                return { initializers, encoder, decoder };
            }

            const initializers = [this.swiftInitializer({ propertiesToTypeNames })];
            const encoder = null;
            const decoder = null;

            return { initializers, encoder, decoder };
        })();

        let definition = `${this.permissionPrefix()}struct ${name}: Codable, Equatable {\n`;
        if (definitions) {
            definition += `${definitions}\n`;
        }
        if (swiftProperties) {
            definition += `${swiftProperties}\n`;
        }
        definition += initializers.join("\n\n");
        definition += "\n";
        if (decoder) {
            definition += `\n${decoder}\n`;
        }
        if (encoder) {
            definition += `\n${encoder}\n`;
        }
        definition += "}";

        return { name, definition };
    }

    swiftInitializer({ propertiesToTypeNames }: { propertiesToTypeNames: Record<string, string> }) {
        const initArguments: string[] = [];
        const content: string[] = [];
        for (const [property, typeName] of Object.entries(propertiesToTypeNames)) {
            initArguments.push(`${property}: ${typeName}${typeName.endsWith("?") ? " = nil" : ""}`);
            content.push(`self.${property} = ${property}`);
        }

        return `${this.permissionPrefix()}init(${initArguments.join(", ")}) {
            ${content.join("\n")}
        }`;
    }

    union({ types, name, scope }: { types: z.ZodTypeAny[]; name: string; scope: Set<z.ZodTypeAny> }) {
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
            isUnion: true,
        });
    }

    permissionPrefix() {
        return this.config.permissionScope === "public" ? "public " : "";
    }
}

const swift = await new TRPCSwift(SampleConfig).root();
await Bun.write("../output/Test.swift", swift);
