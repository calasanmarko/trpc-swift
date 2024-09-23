import { z } from "zod";
import { indent, swiftFieldName, swiftTypeName, swiftZodTypeName } from "./format";
import type {
    TRPCChildRouter,
    TRPCProcedureWithInput,
    TRPCSwiftFullConfiguration,
    TRPCSwiftConfiguration,
    MappedProperties,
} from "./types";
import { allNamedSchemas, type ZodSwiftMetadata } from "./zod";

export class TRPCSwift {
    globalDefinitions: string[] = [];
    globalScope: Set<z.ZodTypeAny> = new Set();
    config: TRPCSwiftFullConfiguration;

    constructor(config: TRPCSwiftConfiguration) {
        this.config = {
            permissionScope: "internal",
            conformance: {
                structs: ["Codable", "Equatable", "Hashable"],
                enums: ["Codable", "Equatable", "Hashable", "CaseIterable"],
            },
            procedures: {
                include: "all",
                subscriptionMode: "sse",
            },
            models: {
                include: "all",
                makeGlobal: "all",
            },
            literals: {
                autoAssignInInitializers: false,
            },
            ...config,
        };
    }

    async root(): Promise<string> {
        const scope = new Set<z.ZodType>();

        if (this.config.models.include === "all") {
            for (const type of allNamedSchemas) {
                this.zodPrimitive({ type, name: type._def.swift?.name ?? "", scope });
            }
        }

        const routerCode = this.router({
            router: this.config.router._def.procedures,
            name: "App",
            scope,
            routerDepth: 0,
        });

        const result = `
            ${await Bun.file(`${import.meta.dir}/../templates/TRPCClient.swift`).text()}
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
            code += `${this.permissionPrefix()}lazy var ${name} = ${swiftTypeName({ name: `${name}Router` })}(url: url.appendingPathComponent("${name}"), middlewares: middlewares)\n`;
            code += this.router({
                router: childRouter,
                name,
                scope,
                routerDepth: routerDepth + 1,
            });
        }

        const result = `
        ${this.permissionPrefix()}class ${swiftTypeName({ name: `${name}Router` })} {
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
        if (procedure._def.type === "subscription" && this.config.procedures.subscriptionMode === "none") {
            return "";
        }

        const swiftMeta = procedure._def.meta?.swift;
        if (
            swiftMeta?.include === false ||
            (this.config.procedures.include !== "all" && swiftMeta?.include === undefined)
        ) {
            return "";
        }

        const input = procedure._def.inputs.at(0) as z.ZodTypeAny;
        const output =
            procedure._def.type === "subscription"
                ? procedure._def.meta?.swift?.subscriptionOutput
                : (procedure._def.output as z.ZodTypeAny);

        if (procedure._def.type === "subscription" && !output) {
            throw new Error(
                `Missing subscription output for ${name}. Please insert swift.subscriptionOutput into the procedure meta.`
            );
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
        const inputData = input ? "input" : `${emptyObjectType}()`;

        if (swiftMeta?.description) {
            result += `/// ${swiftMeta.description}\n`;
        }

        if (procedure._def.type === "subscription") {
            result += `${this.permissionPrefix()}func ${name}(${inputType ? `input: ${inputType}, ` : ""}onMessage: @escaping (${outputType ? outputType : emptyObjectType}) throws -> Void) async throws -> Void {
                try await TRPCClient.startSubscription(url: url.${appendFunction}("${name}"), middlewares: middlewares, input: ${inputData}, onMessage: onMessage)
            }`;
        } else if (procedure._def.type === "query" || procedure._def.type === "mutation") {
            const procedureMethod = (() => {
                if (procedure._def.type === "query") {
                    return "sendQuery";
                }

                if (procedure._def.type === "mutation") {
                    if (input._def.swift?.experimentalMultipartType === "formData") {
                        return "sendMultipartMutation";
                    }
                    return "sendMutation";
                }

                throw new Error(`Unsupported procedure type: ${procedure._def.type}`);
            })();
            result += `${this.permissionPrefix()}func ${name}(${inputType ? `input: ${inputType}` : ""}) async throws -> ${outputType || "Void"} {
                ${outputType ? "return" : `let _: ${emptyObjectType} =`} try await TRPCClient.${procedureMethod}(url: url.${appendFunction}("${name}"), middlewares: middlewares, input: ${inputData})
            }`;
        }

        result += "\n\n";
        return result;
    }

    zodPrimitive({
        type,
        name,
        scope,
        experimentalMultipartType,
    }: {
        type: z.ZodTypeAny;
        name: string;
        scope: Set<z.ZodTypeAny>;
        experimentalMultipartType?: ZodSwiftMetadata["experimentalMultipartType"] | undefined;
    }): {
        name: string;
        definition?: string | undefined;
        experimentalMultipartType?: ZodSwiftMetadata["experimentalMultipartType"] | undefined;
    } | null {
        name = swiftZodTypeName({ name, type });
        experimentalMultipartType = experimentalMultipartType ?? type._def.swift?.experimentalMultipartType;
        const wrapped = (strings: TemplateStringsArray, ...params: z.ZodTypeAny[]) => {
            let innerType = params[0];
            if (
                type._def.typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
                type._def.typeName === z.ZodFirstPartyTypeKind.ZodNullable
            ) {
                while (
                    innerType._def.typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
                    innerType._def.typeName === z.ZodFirstPartyTypeKind.ZodNullable
                ) {
                    innerType = (innerType as z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>).unwrap();
                }
            }

            const innerResult = this.zodPrimitive({
                type: innerType,
                name,
                scope,
                experimentalMultipartType,
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
                case z.ZodFirstPartyTypeKind.ZodAny:
                    if (experimentalMultipartType === "file") {
                        return { name: "TRPCSwiftFile" };
                    }
                    return { name: "Any" };
                case z.ZodFirstPartyTypeKind.ZodString:
                    return { name: "String" };
                case z.ZodFirstPartyTypeKind.ZodNumber:
                    return { name: (type as z.ZodNumber).isInt ? "Int" : "Float" };
                case z.ZodFirstPartyTypeKind.ZodBigInt:
                    return { name: "Int" };
                case z.ZodFirstPartyTypeKind.ZodBoolean:
                    return { name: "Bool" };
                case z.ZodFirstPartyTypeKind.ZodDate:
                    return { name: "Date" };
                case z.ZodFirstPartyTypeKind.ZodSymbol:
                    return { name: "String" };
                case z.ZodFirstPartyTypeKind.ZodOptional:
                    return wrapped`${type}?`;
                case z.ZodFirstPartyTypeKind.ZodNullable:
                    return wrapped`${type}?`;
                case z.ZodFirstPartyTypeKind.ZodArray:
                    return wrapped`[${(type as z.ZodArray<z.ZodTypeAny>)._def.type}]`;
                case z.ZodFirstPartyTypeKind.ZodRecord:
                    return wrapped`[String: ${(type as z.ZodRecord)._def.valueType}]`;
                case z.ZodFirstPartyTypeKind.ZodMap:
                    return wrapped`[String: ${(type as z.ZodMap)._def.valueType}>]`;
                case z.ZodFirstPartyTypeKind.ZodSet:
                    return wrapped`Set<${(type as z.ZodSet)._def.valueType}>`;
                case z.ZodFirstPartyTypeKind.ZodEffects:
                    return wrapped`${(type as z.ZodEffects<never, never>)._def.schema}`;
                case z.ZodFirstPartyTypeKind.ZodDefault:
                    return wrapped`${(type as z.ZodDefault<never>)._def.innerType}`;
                case z.ZodFirstPartyTypeKind.ZodCatch:
                    return wrapped`${(type as z.ZodCatch<never>)._def.innerType}`;
                case z.ZodFirstPartyTypeKind.ZodBranded:
                    return wrapped`${(type as z.ZodBranded<never, never>).unwrap()}`;
                case z.ZodFirstPartyTypeKind.ZodReadonly:
                    return wrapped`${(type as z.ZodReadonly<never>).unwrap()}`;
                case z.ZodFirstPartyTypeKind.ZodLazy:
                    return wrapped`${(type as z.ZodLazy<never>)._def.getter()}`;
                case z.ZodFirstPartyTypeKind.ZodPromise:
                    return wrapped`${(type as z.ZodPromise<never>)._def.type}`;
                case z.ZodFirstPartyTypeKind.ZodPipeline:
                    return wrapped`${(type as z.ZodPipeline<z.ZodNever, never>)._def.in}`;
                case z.ZodFirstPartyTypeKind.ZodUnknown:
                    return { name: "Any" };
                case z.ZodFirstPartyTypeKind.ZodNaN:
                    return null;
                case z.ZodFirstPartyTypeKind.ZodNull:
                    return null;
                case z.ZodFirstPartyTypeKind.ZodVoid:
                    return null;
                case z.ZodFirstPartyTypeKind.ZodNever:
                    return null;
                case z.ZodFirstPartyTypeKind.ZodUndefined:
                    return null;
                case z.ZodFirstPartyTypeKind.ZodObject:
                    if (scope.has(type)) {
                        return { name };
                    }
                    scope.add(type);

                    return this.structure({
                        properties: (type as z.ZodObject<Record<string, z.ZodTypeAny>>).shape,
                        name,
                        description: (type as z.ZodObject<Record<string, z.ZodTypeAny>>)._def.swift?.description,
                        scope: new Set(scope),
                        isFormData: experimentalMultipartType === "formData",
                    });
                case z.ZodFirstPartyTypeKind.ZodEnum:
                    if (scope.has(type)) {
                        return { name };
                    }
                    scope.add(type);
                    return this.enumeration({
                        values: (type as z.ZodEnum<never>)._def.values,
                        name,
                        description: (type as z.ZodEnum<never>)._def.swift?.description,
                    });
                case z.ZodFirstPartyTypeKind.ZodLiteral:
                    if (scope.has(type)) {
                        return { name };
                    }
                    scope.add(type);
                    return this.enumeration({
                        values: [(type as z.ZodLiteral<never>)._def.value],
                        name,
                        description: (type as z.ZodLiteral<never>)._def.swift?.description,
                    });
                case z.ZodFirstPartyTypeKind.ZodUnion:
                    if (scope.has(type)) {
                        return { name };
                    }
                    scope.add(type);
                    return this.union({
                        types: (type as z.ZodUnion<never>)._def.options,
                        name,
                        description: (type as z.ZodUnion<never>)._def.swift?.description,
                        scope: new Set(scope),
                    });
            }

            throw new Error(`Unsupported type: ${type._def.typeName}`);
        })();

        if (
            result &&
            "definition" in result &&
            result.definition &&
            (type._def.swift?.global || (type._def.swift?.name && this.config.models.makeGlobal === "all"))
        ) {
            if (!this.globalScope.has(type)) {
                this.globalDefinitions.push(result.definition);
            }
            this.globalScope.add(type);
            result.definition = undefined;
        }

        return result;
    }

    enumeration({
        values,
        name,
        description,
    }: {
        values: (string | number)[];
        name: string;
        description: string | undefined;
    }) {
        let isValid = false;

        let definition = "";
        if (description) {
            definition += `/// ${description}\n`;
        }

        definition += `${this.permissionPrefix()}enum ${name}: String, ${this.config.conformance.enums.join(", ")} {\n`;
        for (const value of values) {
            if (typeof value === "string") {
                definition += `case ${swiftFieldName({ name: value })} = "${value}"\n`;
                isValid = true;
            }
        }
        definition += "}";
        return isValid ? { name, definition } : null;
    }

    structure({
        properties,
        name,
        description,
        scope,
        isUnion,
        isFormData,
    }: {
        properties: Record<string, z.ZodTypeAny>;
        name: string;
        description: string | undefined;
        scope: Set<z.ZodTypeAny>;
        isUnion?: boolean;
        isFormData?: boolean;
    }) {
        if (isUnion && isFormData) {
            throw new Error(`Error parsing type ${name}: A type cannot be both a union and a form data type.`);
        }

        let definitions = "";
        let swiftProperties = "";
        const mappedProperties: MappedProperties = {};
        for (const [key, value] of Object.entries(properties)) {
            try {
                const formattedKey = swiftFieldName({ name: key });
                const result = this.zodPrimitive({ type: value, name: formattedKey, scope: new Set(scope) });
                if (result) {
                    if (result.definition && !this.globalScope.has(value)) {
                        definitions += `${result.definition}\n`;
                    }

                    const forceOptional = isUnion && !result.name.endsWith("?");
                    swiftProperties += `${this.permissionPrefix()}var ${formattedKey}: ${result.name}${forceOptional ? "?" : ""}\n`;
                    mappedProperties[formattedKey] = {
                        typeName: result.name,
                        schema: value,
                    };
                }
            } catch (e) {
                console.error(e);
            }
        }

        const { initializers, encoder, decoder } = (() => {
            if (isUnion) {
                const initializers = Object.entries(mappedProperties).map(([property, value]) =>
                    this.swiftInitializer({
                        mappedProperties: { [property]: value },
                    })
                );

                const encoder = `${this.permissionPrefix()}func encode(to encoder: Encoder) throws {
                    ${Object.keys(mappedProperties)
                        .map(
                            (property) => `if let ${property} = ${property} {
                                try ${property}.encode(to: encoder)
                                return
                            }`
                        )
                        .join("\n\n")}
                    }`;

                const decoder = `${this.permissionPrefix()}init(from decoder: Decoder) throws {
                    ${Object.entries(mappedProperties)
                        .map(([property, value]) => `self.${property} = try? ${value.typeName}(from: decoder)`)
                        .join("\n")}
                    }`;

                return { initializers, encoder, decoder };
            }

            const initializers = [this.swiftInitializer({ mappedProperties })];
            const encoder = null;
            const decoder = null;

            return { initializers, encoder, decoder };
        })();

        let definition = "";
        if (description) {
            definition += `/// ${description}\n`;
        }

        let conformance = [...this.config.conformance.structs];
        if (isFormData) {
            conformance = conformance.filter((c) => c !== "Codable");
            conformance.push("TRPCSwiftMultipartParsable");
        }

        const jsonFields = Object.entries(mappedProperties)
            .filter(([_, { schema }]) => !schema._def.swift?.experimentalMultipartType)
            .map(([property, _]) => `"${property}": ${property}`);

        const fileFields = Object.entries(mappedProperties)
            .filter(([_, { schema }]) => schema._def.swift?.experimentalMultipartType === "file")
            .map(([property, _]) => `"${property}": ${property}`);

        definition += `${this.permissionPrefix()}struct ${name}: ${conformance.join(", ")} {\n`;
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
        if (isFormData) {
            definition += `\nvar jsonFields: [String: Encodable?] {
                [${jsonFields.join(", ")}]
            }\n`;
            definition += `\nvar fileFields: [String: TRPCSwiftFile?] {
                [${fileFields.join(", ")}]
            }\n`;
        }
        definition += "}";

        return { name, definition };
    }

    swiftInitializer({ mappedProperties }: { mappedProperties: MappedProperties }) {
        const initArguments: string[] = [];
        const content: string[] = [];
        for (const [property, value] of Object.entries(mappedProperties)) {
            const defaultValue = (() => {
                if (value.typeName.endsWith("?")) {
                    return " = nil";
                }
                if (
                    this.config.literals.autoAssignInInitializers &&
                    value.schema._def.typeName === z.ZodFirstPartyTypeKind.ZodLiteral
                ) {
                    return ` = .${swiftFieldName({ name: (value.schema as z.ZodLiteral<never>)._def.value })}`;
                }
                return "";
            })();
            initArguments.push(`${property}: ${value.typeName}${defaultValue}`);
            content.push(`self.${property} = ${property}`);
        }

        return `${this.permissionPrefix()}init(${initArguments.join(", ")}) {
            ${content.join("\n")}
        }`;
    }

    union({
        types,
        name,
        description,
        scope,
    }: {
        types: z.ZodTypeAny[];
        name: string;
        description: string | undefined;
        scope: Set<z.ZodTypeAny>;
    }) {
        return this.structure({
            properties: types.reduce(
                (acc, type, index) => {
                    acc[type._def.swift?.name ?? `type${index}`] = type;
                    return acc;
                },
                {} as Record<string, z.ZodTypeAny>
            ),
            name,
            description,
            scope,
            isUnion: true,
        });
    }

    permissionPrefix() {
        return this.config.permissionScope === "public" ? "public " : "";
    }
}
