import {Schema, model} from 'mongoose';

const UserSchema = new Schema({
    roleId: {
        type: Schema.Types.ObjectId,
        ref: 'Role',
        required: true
    },
    customPermissions: {
        add: {
            type: [String],
            default: []
        },
        remove: {
            type: [String],
            default: []
        }
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
    imageGeneratorModel: {
        type: Schema.Types.ObjectId,
        ref: 'Stability'
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

UserSchema.methods.getEffectivePermissions = async function() {
    await this.populate('roleId');
    const rolePermissions = this.roleId.permissions;
    const addedPermissions = this.customPermissions.add;
    const removedPermissions = this.customPermissions.remove;

    // Добавляем новые разрешения
    let effectivePermissions = [...rolePermissions, ...addedPermissions];

    // Убираем удаленные разрешения
    effectivePermissions = effectivePermissions.filter(permission => !removedPermissions.includes(permission));

    // Удаляем дубликаты
    effectivePermissions = [...new Set(effectivePermissions)];

    return effectivePermissions;
};

export default model('User', UserSchema);