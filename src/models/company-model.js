import { Schema, model } from 'mongoose';

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

export default model("Company", CompanySchema);