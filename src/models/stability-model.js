import { Schema, model } from 'mongoose';

const StabilitySchema = new Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String
    },
    price: {
        type: Schema.Types.Decimal128,
        required: true
    }
});

export default model('Stability', StabilitySchema);