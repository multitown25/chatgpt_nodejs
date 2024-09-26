import {Schema, model} from 'mongoose';

const UserSchema = new Schema({
    roleId: {
        type: Schema.Types.ObjectId,
        ref: 'Role',
        required: true
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    modelId: {
        type: Schema.Types.ObjectId,
        ref: 'Model'
    },
    isActive: {
        type: Boolean,
        default: false
    },
    telegramId: {
        type: String,
        required: true,
        unique: true,
        minLength: [9, "Invalid id. Id's length must be 9-10!"],
        maxLength: [10, "Invalid id. Id's length must be 9-10!"]
    },
    telegramUsername: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActivity: {
        type: Date,
    }

});

export default model('User', UserSchema);