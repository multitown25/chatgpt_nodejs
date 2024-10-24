import { OpenAI } from 'openai';
import config from 'config';
import {code} from "telegraf/format";
import { SocksProxyAgent } from 'socks-proxy-agent';
import { createReadStream } from 'fs'
import axios from "axios";

class OpenAIApi {
    roles = {
        ASSISTANT: 'assistant',
        USER: 'user',
        SYSTEM: 'system',
    }

    agent = new SocksProxyAgent(`socks5://ram:sqlRAM777@103.106.3.47:10088`);
    config = {
        headers: {
            'Authorization': `Bearer ${config.get('OPENAI_TOKEN')}`,
            'Content-Type': 'application/json'
        },
        httpsAgent: this.agent
    }

    constructor(apiKey) {
        this.openai = new OpenAI({
            apiKey
        })
    }

    async chat(messages, model) {
        try {
            // const response = await this.openai.chat.completions.create({
            //     model: "gpt-4o",
            //     messages
            // });
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: model,
                messages
            }, this.config).then(data => data.data);

            console.log(response.choices[0].message.content);
            return {
                content: response.choices[0].message.content,
                tokens: {
                    promptTokens: response.usage?.prompt_tokens,
                    completionTokens: response.usage?.completion_tokens,
                    totalTokens: response.usage?.total_tokens
                }
            };
        } catch (e) {
            console.log('Error while gpt chat', e.message)
            console.log('Error while gpt chat', e.response?.data);
        }
    }

    async translateText(text, targetLanguage) {
        try {
            // const response = await this.openai.chat.completions.create({
            //     model: "gpt-4o",
            //     messages
            // });
            const prompt = `Переведи следующий текст на ${targetLanguage}:\n\n"${text}"`;
            const messages = [
                {role: this.roles.USER, content: prompt}
            ]
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages
            }, this.config).then(data => data.data);

            console.log(response.choices[0].message.content);
            return response.choices[0].message.content;
        } catch (e) {
            console.log('Error while gpt translating text', e.message)
        }
    }

    async transcription(filepath) {
        try {
            const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', {
                file: createReadStream(filepath),
                model: 'whisper-1'
            }, {
                headers: {
                    'Authorization': `Bearer ${config.get('OPENAI_TOKEN')}`,
                    'Content-Type': 'multipart/form-data'
                },
                httpsAgent: this.agent
            }).then(data => data.data);


            return response.text;
        } catch (e) {
            console.log('Error while transcription', e.message)
        }
    }
}

export const openai = new OpenAIApi(config.get('OPENAI_TOKEN'));