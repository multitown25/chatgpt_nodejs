import { Schema, model } from "mongoose";

const RequestSchema = new Schema({
    createdAt: {
        type: Date,
        default: Date.now
    },
    model: {
        type: String,
        required: true
    },
    inputMessage: {
        type: String,
        required: true
    },
    outputMessage: {
        type: String,
        required: true
    },
    promptTokens: {
        type: Number,
        required: true
    },
    completionTokens: {
        type: Number,
        required: true
    },
    totalTokens: {
        type: Number,
        required: true
    },
    price: {
        type: Schema.Types.Decimal128,
        required: true
    }
});

export default model("Request", RequestSchema);