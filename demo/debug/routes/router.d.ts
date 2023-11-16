export declare const appRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
    ctx: object;
    meta: object;
    errorShape: import("@trpc/server").DefaultErrorShape;
    transformer: import("@trpc/server").DefaultDataTransformer;
}>, {
    layer: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").DefaultErrorShape;
        transformer: import("@trpc/server").DefaultDataTransformer;
    }>, {
        depth: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
            ctx: object;
            meta: object;
            errorShape: import("@trpc/server").DefaultErrorShape;
            transformer: import("@trpc/server").DefaultDataTransformer;
        }>, {
            three: import("@trpc/server").BuildProcedure<"query", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: object;
                    meta: object;
                    errorShape: import("@trpc/server").DefaultErrorShape;
                    transformer: import("@trpc/server").DefaultDataTransformer;
                }>;
                _meta: object;
                _ctx_out: object;
                _input_in: {
                    other: {
                        nest: number;
                        bro: {};
                        arr: (string | null)[];
                        arr2?: (string | null)[] | undefined;
                    }[];
                    name?: string | undefined;
                };
                _input_out: {
                    other: {
                        nest: number;
                        bro: {};
                        arr: (string | null)[];
                        arr2?: (string | null)[] | undefined;
                    }[];
                    name?: string | undefined;
                };
                _output_in: {
                    message: string;
                }[];
                _output_out: {
                    message: string;
                }[];
            }, unknown>;
            four: import("@trpc/server").BuildProcedure<"query", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: object;
                    meta: object;
                    errorShape: import("@trpc/server").DefaultErrorShape;
                    transformer: import("@trpc/server").DefaultDataTransformer;
                }>;
                _meta: object;
                _ctx_out: object;
                _input_in: {
                    name?: string | undefined;
                };
                _input_out: {
                    name?: string | undefined;
                };
                _output_in: {
                    message: string;
                } | undefined;
                _output_out: {
                    message: string;
                } | undefined;
            }, unknown>;
        }>;
        nested: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: object;
                meta: object;
                errorShape: import("@trpc/server").DefaultErrorShape;
                transformer: import("@trpc/server").DefaultDataTransformer;
            }>;
            _meta: object;
            _ctx_out: object;
            _input_in: {
                name?: string | undefined;
            };
            _input_out: {
                name?: string | undefined;
            };
            _output_in: {
                message: string;
            };
            _output_out: {
                message: string;
            };
        }, unknown>;
    }>;
    hello: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
            ctx: object;
            meta: object;
            errorShape: import("@trpc/server").DefaultErrorShape;
            transformer: import("@trpc/server").DefaultDataTransformer;
        }>;
        _meta: object;
        _ctx_out: object;
        _input_in: {
            name?: string | undefined;
        };
        _input_out: {
            name?: string | undefined;
        };
        _output_in: {
            message: string;
        };
        _output_out: {
            message: string;
        };
    }, unknown>;
}>;
