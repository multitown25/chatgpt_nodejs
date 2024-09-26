import Model from '../models/model-model.js';


class ModelService {
    async getModelById(id) {
        try {
            const model = await Model.findById(id);

            if (!model) {
                throw new Error('Model not found');
            }

            return model;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async getModelByName(name) {
        try {
            const model = await Model.findOne({name});

            if (!model) {
                throw new Error('Model not found');
            }

            return model;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
}

export default new ModelService();