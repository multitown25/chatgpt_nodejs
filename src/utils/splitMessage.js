// Функция разбиения текста на части, не превышающие maxLength символов
export const splitMessage = (text, maxLength = 4096) => {
    const messages = [];
    let currentMessage = '';

    // Разбиваем текст на слова с учетом пробельных символов
    const words = text.split(/(\s+)/);

    for (const word of words) {
        // Проверяем, не превышает ли добавление слова лимит
        if ((currentMessage + word).length > maxLength) {
            if (currentMessage.length > 0) {
                messages.push(currentMessage);
                currentMessage = '';
            }

            // Если отдельное слово длиннее лимита, разрезаем его
            if (word.length > maxLength) {
                const parts = word.match(new RegExp(`.{1,${maxLength}}`, 'g'));
                messages.push(...parts);
            } else {
                currentMessage += word;
            }
        } else {
            currentMessage += word;
        }
    }

    // Добавляем остаток сообщения
    if (currentMessage.length > 0) {
        messages.push(currentMessage);
    }

    return messages;
};