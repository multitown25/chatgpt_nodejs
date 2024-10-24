import axios from "axios";
import config from "config";
import * as fs from "node:fs";
import {resolve} from "path";

class Stability {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.config = {
            headers: {
                Authorization: `Bearer ${this.apiKey}`
            }
        }
    }

    async getAccountInfo() {
        const url = 'https://api.stability.ai/v1/user/account'

        try {
            const response = await axios.get(url, this.config).then(data => data.data);
            console.log(response);
        } catch (err) {
            console.log('Error while getting Stability account info', err);
            throw err;
        }
    }

    async getAccountBalance() {
        const url = 'https://api.stability.ai/v1/user/balance'

        try {
            const response = await axios.get(url, this.config).then(data => data.data);
            console.log(response);
        } catch (err) {
            console.log('Error while getting Stability account balance', err);
            throw err;
        }
    }

    async generateImage(prompt) { // model name arg
        const url = 'https://api.stability.ai/v2beta/stable-image/generate/core'

        const form = new FormData();
        const payload = {
            prompt: "White horse in the snow night mountain",
            output_format: "png"
        }
        form.append('prompt', prompt);
        form.append('output_format', payload.output_format);

        try {
            const config = {
                ...this.config,
                headers: {
                    ...this.config.headers,
                    Accept: "image/*"
                },
                responseType: "arraybuffer"
            }
            const response = await axios.post(url, form, config);

            return response.data;
            // fs.writeFileSync('../../images/generated_image.png', Buffer.from(response.data));

            // console.log('Изображение успешно сохранено как generated_image.png');
        } catch (err) {
            console.log('Error while generating Stability image', err.message);

            if (err.response?.status === 403) {

            }
            throw err;
        }
    }
}

export const stability =  new Stability(config.get('STABILITY_API_KEY'));