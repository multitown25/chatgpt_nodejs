import { Schema, model} from 'mongoose';

const PermissionSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    value: {
        type: Boolean,
        required: true
    },
    description: {
        type: String
    },
    roleId: {
        type: Schema.Types.ObjectId,
        ref: 'Role'
    },
    customPermission: {
        type: Schema.Types.ObjectId,
        ref: 'CustomPermission'
    }
});

export default model('Permission', PermissionSchema);