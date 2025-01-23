import axios from "axios";
import config from "config";
import fs from "node:fs";
import {resolve} from "path";
import StabilityModel from "../models/stability-model.js";
import UserService from "./user-service.js";
import * as path from "node:path";
import {fileURLToPath} from "url";

class Stability {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.config = {
            headers: {
                Authorization: `Bearer ${this.apiKey}`
            }
        }
    }

    imageGeneratorURL = {
        'Stable Image Ultra': 'https://api.stability.ai/v2beta/stable-image/generate/ultra',
        'Stable Image Core': 'https://api.stability.ai/v2beta/stable-image/generate/core'
    }

    upscaleURL = {
        'Fast': 'https://api.stability.ai/v2beta/stable-image/upscale/fast'
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

    async generateImage(prompt, tgId) { // model name arg
        const model = await UserService.getUserImageGeneratorModel(tgId);
        console.log('Image Generator Model', model);
        const url = this.imageGeneratorURL[model.name];

        const outputFormat = 'png';

        const form = new FormData();
        form.append('prompt', prompt);
        form.append('output_format', outputFormat);

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
        } catch (err) {
            console.log('Error while generating Stability image', err.message);

            if (err.response?.status === 403) {

            }
            throw err;
        }
    }

    async upscaleImage(image, tgId) {
        // const model = await UserService.getUserImageGeneratorModel(tgId);
        // console.log('Image Generator Model', model);
        // const url = this.imageGeneratorURL[model.name];
        const url = this.upscaleURL['Fast'];
        const blobImage = await fs.openAsBlob(image);
        console.log('blobImage', blobImage)

        const outputFormat = 'png';

        const form = new FormData();
        form.append('image', blobImage);
        form.append('output_format', outputFormat);

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
        } catch (err) {
            console.log('Error while upscaling Stability image', `${err.response.status}: ${err.response.data.toString()}`);

            if (err.response?.status === 403) {

            }
            throw err;
        }
    }

    async outpaintImage(image, tgId) {
        // const model = await UserService.getUserImageGeneratorModel(tgId);
        // console.log('Image Generator Model', model);
        // const url = this.imageGeneratorURL[model.name];
        const url = 'https://api.stability.ai/v2beta/stable-image/edit/outpaint';
        const blobImage = await fs.openAsBlob(image);
        console.log('blobImage', blobImage)

        const outputFormat = 'png';

        const form = new FormData();
        form.append('image', blobImage);
        form.append('right', 200);
        form.append('left', 200);
        form.append('up', 200);
        form.append('down', 200);
        form.append('output_format', outputFormat);

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
        } catch (err) {
            console.log('Error while outpainting Stability image', `${err.response.status}: ${err.response.data}`);
            throw err;
        }
    }

    async searchAndReplaceImage(image, tgId) {
        const url = 'https://api.stability.ai/v2beta/stable-image/edit/search-and-replace';
        const blobImage = await fs.openAsBlob(image);
        console.log('blobImage', blobImage)

        const outputFormat = 'png';

        const form = new FormData();
        form.append('image', blobImage);
        form.append('prompt', "A basketball player");
        form.append('search_prompt', "A girl");
        // form.append('grow_musk', 3);
        form.append('output_format', outputFormat);

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
        } catch (err) {
            console.log('Error while search and replace Stability image', `${err.response.status}: ${err.response.data}`);
            throw err;
        }
    }

    async searchAndRecolorImage(image, tgId) {
        const url = 'https://api.stability.ai/v2beta/stable-image/edit/search-and-recolor';
        const blobImage = await fs.openAsBlob(image);
        console.log('blobImage', blobImage)

        const outputFormat = 'png';

        const form = new FormData();
        form.append('image', blobImage);
        form.append('prompt', "A green cat");
        form.append('select_prompt', "A cat");
        form.append('output_format', outputFormat);

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
        } catch (err) {
            console.log('Error while search and recolor Stability image', `${err.response.status}: ${err.response.data}`);
            throw err;
        }
    }

    async removeBackgroundImage(image, tgId) {
        const url = 'https://api.stability.ai/v2beta/stable-image/edit/remove-background';
        const blobImage = await fs.openAsBlob(image);
        console.log('blobImage', blobImage)

        const outputFormat = 'png';

        const form = new FormData();
        form.append('image', blobImage);
        form.append('output_format', outputFormat);

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
        } catch (err) {
            console.log('Error while removing background Stability image', `${err.response.status}: ${err.response.data}`);
            throw err;
        }
    }

    async sketchImage(image, tgId) {
        const url = 'https://api.stability.ai/v2beta/stable-image/control/sketch';
        const blobImage = await fs.openAsBlob(image);
        console.log('blobImage', blobImage)

        const outputFormat = 'png';

        const form = new FormData();
        form.append('image', blobImage);
        form.append('prompt', "A gold penguin");
        form.append('output_format', outputFormat);

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
        } catch (err) {
            console.log('Error while removing background Stability image', `${err.response.status}: ${err.response.data}`);
            throw err;
        }
    }

    async styleImage(image, tgId) {
        const url = 'https://api.stability.ai/v2beta/stable-image/control/style';
        const blobImage = await fs.openAsBlob(image);
        console.log('blobImage', blobImage)

        const outputFormat = 'png';

        const form = new FormData();
        form.append('image', blobImage);
        form.append('prompt', "Anime 2D");
        form.append('output_format', outputFormat);

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
        } catch (err) {
            console.log('Error while styling Stability image', `${err.response.status}: ${err.response.data}`);
            throw err;
        }
    }
}

export const stability =  new Stability(config.get('STABILITY_API_KEY'));