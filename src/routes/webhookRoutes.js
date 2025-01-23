import express from 'express';
import Transaction from '../models/transaction-model.js';
import Wallet from '../models/wallet-model.js';
import crypto from 'crypto';

const router = express.Router();

const TINKOFF_PASSWORD = process.env.TINKOFF_PASSWORD; // Пароль для подписи

// Функция для проверки подписи
const verifySignature = (data, receivedSignature) => {
    // 1. Исключаем поле Signature из данных
    const { Signature, ...filteredData } = data;

    // 2. Добавляем поле Password
    const dataWithPassword = { ...filteredData, Password: TINKOFF_PASSWORD };

    // 3. Получаем массив ключей и сортируем их по алфавитному порядку
    const sortedKeys = Object.keys(dataWithPassword).sort();

    // 4. Конкатенируем значения в отсортированном порядке
    const signatureString = sortedKeys.map(key => dataWithPassword[key]).join('');

    // 5. Вычисляем SHA-256 хеш и преобразуем его в верхний регистр
    const calculatedSignature = crypto.createHash('sha256').update(signatureString).digest('hex').toUpperCase();

    // 6. Сравниваем вычисленную подпись с полученной
    return calculatedSignature === receivedSignature;
};

router.post('/tinkoff', express.urlencoded({ extended: false }), async (req, res) => {
    const data = req.body;
    console.log("WEBHOOK TINKOFF", data);

    // Проверка подписи
    const isValidSignature = verifySignature(data, data.Signature);
    if (!isValidSignature) {
        return res.status(400).send('Invalid signature');
    }

    const { Status, PaymentId, OrderId, Amount } = data;

    try {
        const transaction = await Transaction.findOne({ tinkoffPaymentId: PaymentId });
        console.log('Transaction', transaction);
        if (!transaction) {
            return res.status(404).send('Transaction not found');
        }

        if (Status === 'CONFIRMED') {
            if (transaction.status !== 'completed') {
                console.log('Transaction completed. Transaction status ', transaction.status);
                transaction.status = 'completed';
                await transaction.save();

                // Обновить баланс кошелька
                const wallet = await Wallet.findById(transaction.wallet);
                if (wallet) {
                    wallet.balance = parseFloat(wallet.balance) + parseFloat(Amount) / 100; // Конвертация из копеек
                    console.log('Wallet balance = ', wallet);
                    await wallet.save();
                }
            }
        } else if (Status === 'REJECTED' || Status === 'CANCELLED') {
            transaction.status = 'failed';
            await transaction.save();
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;