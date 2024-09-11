import { z } from "zod";

export const indent = (str: string) => {
    const tabWidth = 4;
    let indentLevel = 0;
    let result = "";
    for (const line of str.split("\n")) {
        if (!line.includes("{") && line.includes("}")) {
            indentLevel--;
        }

        const spaces = indentLevel
            ? Array(indentLevel * tabWidth)
                  .fill(" ")
                  .join("")
            : "";
        result += spaces + line.trim() + "\n";

        if (line.includes("{") && !line.includes("}")) {
            indentLevel++;
        }
    }

    return result;
};

export const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export const swiftTypeName = ({ name, preferredName }: { name: string; preferredName?: string }) => {
    const reservedWords = new Set(["Type", "Protocol", "Class", "Enum", "Struct", "Extension", "Self"]);
    const capitalizedGeneratedName = capitalizeFirstLetter(name);
    const finalName = preferredName ?? capitalizedGeneratedName;

    return reservedWords.has(finalName) ? `_${finalName}` : finalName;
};

export const swiftFieldName = ({ name }: { name: string }) => {
    const filteredName = name
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/_([a-z])/gi, ($1) => $1.toUpperCase().replace("_", ""));

    const reservedWords = new Set([
        "public",
        "private",
        "internal",
        "default",
        "self",
        "class",
        "enum",
        "struct",
        "init",
        "let",
        "try",
        "do",
        "catch",
    ]);
    return reservedWords.has(filteredName) ? `_${filteredName}` : filteredName;
};

export const swiftZodTypeName = ({ name, type }: { name: string; type: z.ZodTypeAny }) => {
    return swiftTypeName({
        name,
        preferredName: type._def.swift?.name,
    });
};
