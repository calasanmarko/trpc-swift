import { initTRPC, tracked } from "@trpc/server";
import { extendZodWithSwift } from "trpc-swift";
import { z } from "zod";
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
                name: "Person",
            }),
        favoriteColors: z.array(z.enum(["red", "green", "blue"]).optional()).nullish(),
        dateCreated: z.coerce.date(),
    })
    .strict();

export const appRouter = router({
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
