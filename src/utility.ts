export const processTypeName = (name: string) => {
    const processedName = snakeToCamelCase(name);
    return processedName.charAt(0).toUpperCase() + processedName.slice(1);
};

export const processFieldName = (name: string): string => {
    const reservedFields = ["internal"];

    const processedName = snakeToCamelCase(name);
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

        lines[i] =
            Array(indentLevel * spaces)
                .fill(" ")
                .join("") + lines[i];

        if (lines[i].includes("{")) {
            indentLevel++;
        }
    }

    return lines.join("\n");
};
