export const trpcSwiftSerialize = (obj: object): unknown => {
    if (typeof obj !== "object" || obj === null) {
        return obj;
    }

    if (obj instanceof Set) {
        return Array.from(obj);
    }

    if (obj instanceof Date) {
        return obj.toISOString();
    }

    if (Array.isArray(obj)) {
        return obj.map(trpcSwiftSerialize);
    }

    return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, trpcSwiftSerialize(value)]));
};

export const trpcSwiftTransformer = {
    input: {
        serialize: (obj: unknown) => obj,
        deserialize: (obj: unknown) => obj,
    },
    output: {
        serialize: trpcSwiftSerialize,
        deserialize: (obj: unknown) => obj,
    },
};
