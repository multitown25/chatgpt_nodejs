export function escapeMarkdownV2(s) {
    const escapables = {
        "_": "\\_",
        "*": "\\*",
        "[": "\\[",
        "]": "\\]",
        "(": "\\(",
        ")": "\\)",
        "~": "\\~",
        "": "\\",
        ">": "\\>",
        "#": "\\#",
        "+": "\\+",
        "-": "\\-",
        "=": "\\=",
        "|": "\\|",
        "{": "\\{",
        "}": "\\}",
        ".": "\\.",
        "!": "\\!",
    };

    const toEscape = new RegExp("[" + Object.values(escapables).join("") + "]", "g");

    return s?.replace(toEscape, r => escapables[r] || r);
}