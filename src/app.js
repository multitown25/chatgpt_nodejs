import express from 'express';
import mongoose from 'mongoose';
import paymentRoutes from './routes/paymentRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import dotenv from 'dotenv';
import bot from "./bot.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// Маршруты
// app.use('/payment', paymentRoutes);
// app.use('/webhook', webhookRoutes);
//
// // Обработка ошибок
// app.use((err, req, res, next) => {
//     console.error('Unhandled error:', err);
//     res.status(500).json({ error: 'Internal Server Error' });
// });

const PORT = 8020;

// // Подключение к MongoDB и запуск сервера
// const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Подключение к MongoDB
const start = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Successfully connected to MongoDB');
    } catch (err) {
        console.error('Error connecting to MongoDB', err);
        process.exit(1);
    }

    // Настройка Webhook для Telegram
    const WEBHOOK_URL = `${process.env.BASE_URL}/bot/webhook/${bot.token}`; // Убедитесь, что BASE_URL настроен правильно
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`Webhook установлен на ${WEBHOOK_URL}`);

    // Используем Webhook-колбэк
    app.use(bot.webhookCallback(`/bot/webhook/${bot.token}`));

    app.use('/payment', paymentRoutes);
    app.use('/webhook', webhookRoutes);

    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
};

start();

process.once('SIGINT', () => {
    bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    process.exit(0);
});