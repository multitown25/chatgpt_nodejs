import { Schema, model } from 'mongoose';

const ModelSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    inputPrice: {
        type: Schema.Types.Decimal128,
        required: true
    },
    outputPrice: {
        type: Schema.Types.Decimal128,
        required: true
    }
});

export default model('Model', ModelSchema);