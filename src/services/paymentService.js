import axios from "axios";
import Transaction from "../models/transaction-model.js";
import Wallet from "../models/wallet-model.js";
import crypto from 'crypto';
import * as querystring from "node:querystring";
import dotenv from "dotenv";
dotenv.config();

const TINKOFF_TERMINAL_KEY = process.env.TINKOFF_TERMINAL_KEY; // Terminal ID
const TINKOFF_PASSWORD = process.env.TINKOFF_PASSWORD; // Пароль
const TINKOFF_URL = 'https://securepay.tinkoff.ru/v2/Init';

const createPayment = async (companyId, amount, description, orderId) => {
    const wallet = await Wallet.findOne({ company: companyId });
    if (!wallet) throw new Error('Wallet not found');

    // Создаем транзакцию со статусом pending
    const transaction = await Transaction.create({
        wallet: wallet._id,
        amount: amount,
        type: 'income',
        description: description,
        status: 'pending',
    });

    const postData = {
        Amount: Math.round(amount * 100), // В копейках
        Description: description,
        OrderId: orderId || transaction._id.toString(),
        TerminalKey: TINKOFF_TERMINAL_KEY,
        NotificationURL: `${process.env.BASE_URL}/webhook/tinkoff`,
        Password: TINKOFF_PASSWORD,
    };
    console.log(JSON.stringify(postData));

    const sortedKeys = Object.keys(postData).sort();

    const signatureString = sortedKeys.map(key => postData[key]).join('');

    const sign = crypto.createHash('sha256').update(signatureString).digest('hex');

    delete postData.Password;

    postData.Token = sign;

    // Отправка запроса на инициализацию платежа
    const response = await axios.post(TINKOFF_URL, postData, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const responseData = response.data;
    console.log(sign);
    // console.log(postData);
    console.log(responseData);

    if (responseData.ErrorCode !== '0') {
        throw new Error(`Ошибка инициализации платежа: ${responseData.Message}`);
    }

    // Сохраняем ID платежа от Тинькофф
    transaction.tinkoffPaymentId = responseData.PaymentId;
    await transaction.save();

    return responseData.PaymentURL; // URL для перенаправления клиента на оплату
};

export { createPayment };