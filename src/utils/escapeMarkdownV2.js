const MARKDOWN_V2_REGEX = /([_*\[\]()~`>#+\-=|{}.!])/g;

export const escapeMarkdown = (text) => {
    return text.replace(MARKDOWN_V2_REGEX, '\\$1');
};
