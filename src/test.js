// import axios from "axios";
//
// const WEBHOOK_URL = 'https://b24.flaconrf.ru/rest/9242/ek2r7ghm5y2ccfwg/';
// const WEBHOOK_URL2 = 'https://b24.flaconrf.ru/rest/9242/ek2r7ghm5y2ccfwg/im.message.add.json';
//
// // Функция для отправки сообщения
// const sendMessage = async (dialogId, message) => {
//     try {
//         const response = await axios.post(`${WEBHOOK_URL}im.notify.personal.add`, null, {
//             params: {
//                 USER_ID: dialogId,
//                 MESSAGE: message
//             }
//         });
//         return response.data;
//     } catch (error) {
//         console.error('Ошибка при отправке сообщения:', error.response ? error.response.data : error.message);
//         throw error;
//     }
// };
//
// // const res = await sendMessage('9242', 'PERSONAL NOTIFICATION');
// // console.log(res);
// const res = await axios.post(`https://b24.flaconrf.ru/rest/9242/mgt77thaanrnkkmx/imbot.message.add `, null,{
//     params: {
//         DIALOG_ID: 'chat63600',
//         CLIENT_ID: 'pesttq387d4nfjf3tyc52e047p6d9erm',
//         MESSAGE: 'HELLO'
//     }
// }).then(res => res.data);
// console.log(res)

// import {stability} from "./services/stability.js";
// stability.generateImage();

const date1 = new Date().toLocaleString()
const date2 = Date.now();
console.log(date1);
console.log(date2);