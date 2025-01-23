import { Schema, model } from 'mongoose';

const TransactionSchema = new Schema({
    wallet: {
        type: Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true
    },
    amount: {
        type: Schema.Types.Decimal128,
        required: true
    },
    type: {
        type: String,
        enum: ['income', 'expense'],
        required: true
    },
    description: {
        type: String
    },
    tinkoffPaymentId: {
        type: String, // ID платежа из Тинькофф для отслеживания
        required: false
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default model('Transaction', TransactionSchema);
