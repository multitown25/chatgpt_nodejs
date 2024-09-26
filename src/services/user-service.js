import User from '../models/user-model.js';
import RoleService from "./role-service.js";
import CompanyService from "./company-service.js";
import ModelService from "./model-service.js";

class UserService {
    async register(roleName, companyName, telegramId) {
        const roleId = await RoleService.getRoleId(roleName);
        const companyId = await CompanyService.getCompanyId(companyName);

        const newUser = new User({
            roleId: roleId,
            companyId: companyId,
            telegramId: telegramId,
            isActive: true
        });

        try {
            const savedUser = await newUser.save();
            console.log('User Saved', savedUser);
            return savedUser;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async getUserByTgId(tgId) {
        try {
            const user = await User.findOne({telegramId: tgId});

            if (!user) {
                throw new Error('User not found');

            }
            return user;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async updateUserByTgId(tgId, updateData) {
        try {
            const updatedUser = await User.findOneAndUpdate(
                {telegramId: tgId},
                {$set: updateData},
                {new: true, runValidators: true}
            );

            if (!updatedUser) {
                throw new Error('User not found');
            }

            return updatedUser;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async getUserModel(telegramId) {
        try {
            const user = await User.findOne({telegramId}).populate('modelId');

            if (user && user.modelId) {
                console.log('Название модели пользователя:', user.modelId.name);
                return user.modelId;
            } else {
                console.log('Модель не назначена или пользователь не найден.');
                return null;
            }
        } catch (error) {
            console.error('Ошибка при получении пользователя:', error);
            throw error;
        }
    }

    async setUserModel(telegramId, modelName) {
        try {
            const model = await ModelService.getModelByName(modelName);
            if (!model) {
                throw new Error('Model not found');
            }
            const updatedUser = await User.findOneAndUpdate({telegramId}, {
                modelId: model._id,
                lastActivity: Date.now()
            }, {
                new: true,
                runValidators: true
            });

            if (!updatedUser) {
                throw new Error('Пользователь не найден.');
            }

            return updatedUser;
        } catch (error) {
            console.error('Ошибка при получении пользователя:', error);
            throw error;
        }
    }
}

export default new UserService();

