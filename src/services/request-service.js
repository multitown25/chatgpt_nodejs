import Request from '../models/request-model.js';

class RequestService {
    async create(modelName, userId, companyId, inputMsg, outputMsg, promptTokens, completionTokens, totalTokens, price, options = {}) {
        const { session } = options;
        const request = new Request({
            model: modelName,
            userId: userId,
            companyId: companyId,
            inputMessage: inputMsg,
            outputMessage: outputMsg,
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            totalTokens: totalTokens,
            price: price
        });

        if (session) {
            await request.save({ session });
        } else {
            await request.save();
        }
    }
}

export default new RequestService();