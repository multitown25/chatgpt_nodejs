import { Schema, model } from 'mongoose';
import Wallet from './wallet-model.js';

const CompanySchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    address: {
        type: String,
        required: true,
    }
});

CompanySchema.post('save', async function(doc, next) {
    try {
        const existingWallet = await Wallet.findOne({ company: doc._id });
        if (!existingWallet) {
            await Wallet.create({ company: doc._id });
        }
        next();
    } catch (error) {
        next(error);
    }
});

export default model("Company", CompanySchema);