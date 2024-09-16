import { OpenAI } from 'openai';
import config from 'config';
import {code} from "telegraf/format";

class OpenAIApi {
    roles = {
        ASSISTANT: 'assistant',
        USER: 'user',
        SYSTEM: 'system',
    }

    constructor(apiKey) {
        this.openai = new OpenAI({
            apiKey
        })
    }

    async chat(messages) {
        try {
            const response = await this.openai.chat.completions.create({
                model: "o1-mini",
                messages
            });
            return response.choices[0];
        } catch (e) {
            console.log('Error while gpt chat', e.message)
        }
    }

    async transcription() {

    }
}

export const openai = new OpenAIApi(config.get('OPENAI_TOKEN'));