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
app.use('/payment', paymentRoutes);
app.use('/webhook', webhookRoutes);

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = 8020;

// // Подключение к MongoDB и запуск сервера
// const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('MongoDB connected');

        const WEBHOOK_URL = `${process.env.BASE_URL}/bot/webhook/${bot.token}`; // Убедитесь, что BASE_URL настроен правильно
        await bot.telegram.setWebhook(WEBHOOK_URL);
        console.log(`Webhook установлен на ${WEBHOOK_URL}`);

        app.use(bot.webhookCallback(`/bot/webhook/${bot.token}`));

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });


process.once('SIGINT', () => {
    bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    process.exit(0);
});