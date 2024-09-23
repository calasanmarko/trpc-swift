import { initTRPC, tracked } from "@trpc/server";
import { extendZodWithSwift } from "trpc-swift";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { TRPCSwiftMeta } from "../../trpc-swift/src/types";
import { observable } from "@trpc/server/observable";

const t = initTRPC.meta<TRPCSwiftMeta>().create({});
const router = t.router;
const publicProcedure = t.procedure;

extendZodWithSwift(z);

export const personSchema = z
    .object({
        fullName: z.string(),
        age: z.number().int().nullish(),
        gpa: z.number().optional(),
        classes: z
            .object({
                name: z.string(),
                isCool: z.boolean().nullish(),
            })
            .array()
            .swift({
                name: "Class",
            }),
        favoriteColors: z.array(z.enum(["red", "green", "blue"]).optional()).nullish(),
        dateCreated: z.coerce.date(),
    })
    .strict();

export const multipartSchema = zfd
    .formData({
        person: zfd.json(personSchema),
        file1: zfd.file().swift({ experimentalMultipartType: "file" }),
        file2: zfd.file().nullish().swift({ experimentalMultipartType: "file" }),
    })
    .swift({
        name: "Multipart",
        experimentalMultipartType: "formData",
    });

export const appRouter = router({
    multipartUpload: publicProcedure
        .input(multipartSchema)
        .output(
            z.object({
                file1Bytes: z.number().int(),
                file2Bytes: z.number().int().nullish(),
            })
        )
        .mutation(({ input }) => {
            console.log({ input });
            return {
                file1Bytes: input.file1.size,
                file2Bytes: input.file2?.size ?? null,
            };
        }),

    stringLength: publicProcedure
        .meta({ swift: { description: "Get the length of a string" } })
        .input(z.string())
        .output(z.number().int())
        .query(({ input }) => input.length),

    testListener: publicProcedure
        .meta({
            swift: {
                subscriptionOutput: z.object({
                    index: z.number(),
                    value: z.string(),
                }),
            },
        })
        .input(z.string())
        .subscription(({ input }) =>
            observable(({ next, complete }) => {
                const trackingId = crypto.randomUUID();
                let index = 0;

                const interval = setInterval(() => {
                    const value = { index: index++, value: input };
                    next(tracked(trackingId, value));
                    if (index > 10) {
                        complete();
                    }
                }, 500);

                return () => clearInterval(interval);
            })
        ),
    childRouter: router({
        people: publicProcedure
            .input(personSchema)
            .output(
                z.object({
                    coolnessFactor: z.number(),
                    bestProperty: z
                        .object({
                            classes: z.object({
                                type: z.literal("classes"),
                                classes: personSchema.shape.classes,
                            }),
                            gpa: z
                                .object({
                                    type: z.literal("gpa"),
                                    gpa: personSchema.shape.gpa,
                                })
                                .swift({ name: "GPA" }),
                            nothing: z.literal(null),
                        })
                        .optional(),
                    someDate: z.date(),
                })
            )
            .query(({ input }) => {
                return {
                    coolnessFactor: 10,
                    bestProperty: {
                        classes: {
                            type: "classes",
                            classes: input.classes,
                        },
                        gpa: {
                            type: "gpa",
                            gpa: input.gpa,
                        },
                        nothing: null,
                    },
                    someDate: new Date(),
                };
            }),

        unions: publicProcedure
            .input(
                z.object({
                    weird: z.union([
                        z.string(),
                        z.number(),
                        z
                            .object({
                                name: z.string(),
                                age: z.number(),
                            })
                            .swift({ name: "Weirder", global: true }),
                    ]),
                })
            )
            .mutation(() => {
                return;
            }),
    }),
});
