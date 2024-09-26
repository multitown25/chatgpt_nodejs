import { Schema, model } from 'mongoose';

const CustomPermissionSchema = new Schema({
    value: {
        type: Boolean,
        required: true
    }
});

export default model('CustomPermission', CustomPermissionSchema);