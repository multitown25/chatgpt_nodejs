import express from 'express';
import { createPayment } from '../services/paymentService.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.post('/create-payment', async (req, res) => {
    try {
        const { companyId, amount, description, chatId } = req.body;
        if (!companyId || !amount || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const orderId = uuidv4(); // Генерация уникального OrderId
        const confirmationUrl = await createPayment(companyId, amount, description, orderId, chatId);
        res.json({ confirmationUrl });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;