import axios from "axios";

const WEBHOOK_URL = 'https://b24.flaconrf.ru/rest/9242/ek2r7ghm5y2ccfwg/';
const WEBHOOK_URL2 = 'https://b24.flaconrf.ru/rest/9242/ek2r7ghm5y2ccfwg/im.message.add.json';

// Функция для отправки сообщения
const sendMessage = async (dialogId, message) => {
    try {
        const response = await axios.post(`${WEBHOOK_URL}im.message.add`, null, {
            params: {
                DIALOG_ID: dialogId,
                MESSAGE: message
            }
        });
        return response.data;
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error.response ? error.response.data : error.message);
        throw error;
    }
};

const res = await sendMessage('20459', 'HELLO MY BOY');
console.log(res);