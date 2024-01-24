export const processTypeName = (name: string) => {
    const reservedTypes = ["Type"];

    let processedName = snakeToCamelCase(name);
    processedName = processedName.charAt(0).toUpperCase() + processedName.slice(1);
    if (reservedTypes.includes(processedName)) {
        return `_${processedName}`;
    }

    return processedName;
};

export const processFieldName = (name: string): string => {
    const reservedFields = ["internal", "public", "private"];

    let processedName = snakeToCamelCase(name);
    processedName = processedName.charAt(0).toLowerCase() + processedName.slice(1);
    if (reservedFields.includes(processedName)) {
        return `_${name}`;
    }

    return processedName;
};

export const snakeToCamelCase = (name: string): string => {
    return name.replace(/([-_][a-z])/gi, ($1) => {
        return $1.toUpperCase().replace("-", "").replace("_", "");
    });
};

export const indentSwiftCode = (code: string, spaces: number = 4): string => {
    const lines = code.split("\n");
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("}")) {
            indentLevel--;
        }

        if (!lines[i].startsWith(" ")) {
            lines[i] =
                Array(indentLevel * spaces)
                    .fill(" ")
                    .join("") + lines[i];
        }

        if (lines[i].includes("{")) {
            indentLevel++;
        }
    }

    return lines.join("\n");
};
