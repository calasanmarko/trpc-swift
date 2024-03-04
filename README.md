# trpc-swift

Generates native Swift clients for tRPC apps.

# Installation

Available as a npm package.

```
npm install --save-dev trpc-swift
```

# Usage

```
Usage: trpc-swift -r [routerName] -i [routerPath] -o [outputPath]
Options:
  -r, --router-name  Set the router name that should be found in the input file
  -i, --input        Set the path where the tRPC input tRPC router is located
  -o, --output       Set the output path for the generated Swift client
  -g, --global-mode  Control which models are placed by default in the global scope.
      all            All named models will be placed in the global scope by default.
      top            Only named models directly referenced by routes will be placed in the global scope by default.
      none           No models will be placed in the global scope by default.
  -a, --alias        Create public type aliases for all models in the global scope.
  -s, --shared       Create a shared singleton instance of the generated Swift client.
  -h, --help         Display this help message
  -q, --quiet        Run in quiet mode (no output except for fatal errors)
```

# Generation

All routes in the input router are automatically detected and converted into Swift classes. Nested routers create nested Swift classes, tRPC procedures get converted into Swift methods. All referenced Zod input/output schemas, as well as their children get converted into Swift structures.

For instance, the following tRPC router and Zod schemas:

```
extendZodWithSwift(z);

const userSchema = z
    .object({
        id: z.string().uuid(),
        name: z.object({
            first: z.string(),
            middle: z.string().optional(),
            last: z.string(),
        }),
        email: z.string().optional(),
        dateCreated: z.date(),
    })
    .swift({
        name: "User",
    });

export const appRouter = router({
    user: router({
        get: authClientProcedure
            .meta({
                swift: {
                    description: "Fetches a user by ID.",
                },
            })
            .input(
                z.object({
                    id: userSchema.shape.id,
                })
            )
            .output(userSchema)
            .query(/** some implementation */),
    }),
});
```

will result in the following generated Swift client:

```
class AppRouter: TRPCClientData {
    lazy var user = UserRoute(clientData: self)

    // Scaffolding omitted

    init(baseUrl: URL? = nil, middlewares: [TRPCMiddleware] = []) {
        self.baseUrl = baseUrl
        self.baseMiddlewares = middlewares
    }

    struct User: Codable, Equatable {
        var id: String
        struct Name: Codable, Equatable {
            var first: String
            var middle: String?
            var last: String
        }
        var name: Name
        var email: String?
        var dateCreated: Date
    }

    class UserRoute: TRPCClientData {
        let clientData: TRPCClientData

        // Scaffolding omitted...

        struct GetInputType: Codable, Equatable {
            var id: String
        }

        /// Fetches a user by ID.
        func get(input: GetInputType) async throws -> User {
            return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("get"), middlewares: middlewares, input: input)
        }
    }
}
```

The generated Swift class is self-contained, handles networking and routing. All you need to do is add it to your Swift project.

# License

Made by Marko Calasan, 2023.

This product is licensed under the MIT License.
