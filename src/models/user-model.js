import {Schema, model} from 'mongoose';

const UserSchema = new Schema({
    roleId: {
        type: Schema.Types.ObjectId,
        ref: 'Role',
        required: true
    },
    company: {
        id: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: true
        },
        name: {
            type: String,
            required: true
        }
    },
    modelId: {
        type: Schema.Types.ObjectId,
        ref: 'Model'
    },
    firstname: {
        type: String
    },
    lastname: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: false
    },
    telegramId: {
        type: String,
        unique: true,
        minLength: [9, "Invalid id. Id's length must be 9-10!"],
        maxLength: [10, "Invalid id. Id's length must be 9-10!"]
    },
    telegramUsername: {
        type: String,
        required: true
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