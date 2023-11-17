export const processTypeName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1);
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
