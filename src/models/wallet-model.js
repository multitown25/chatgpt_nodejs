import { Schema, model } from 'mongoose';

const WalletSchema = new Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        unique: true // 1 компания = 1 кошелек
    },
    balance: {
        type: Schema.Types.Decimal128,
        required: true,
        default: 0
    },
    currency: {
        type: String,
        default: 'RUB',
        enum: ['RUB', 'USD', 'EUR'] // на момент написания кода интернет-эквайринг тбанка работает только с рублями
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// обновление поля updatedAt перед сохранением
WalletSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default model('Wallet', WalletSchema);
