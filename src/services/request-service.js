import Request from '../models/request-model.js';

class RequestService {
    async create(model, inputMessage, outputMessage, promptTokens, completionTokens, totalTokens, price) {
        try {
            const newRequest = await Request.create({
                model,
                inputMessage,
                outputMessage,
                promptTokens,
                completionTokens,
                totalTokens,
                price
            });

            return newRequest;
        } catch (e) {
            console.log(e);
            throw e;
        }
    }
}

export default new RequestService();