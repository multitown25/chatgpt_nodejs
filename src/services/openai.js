import { OpenAI } from 'openai';
import config from 'config';
import {code} from "telegraf/format";
import { SocksProxyAgent } from 'socks-proxy-agent';
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
        httpsAgent: this.agent,
        // responseType: 'stream'
    }

    constructor(apiKey) {
        this.openai = new OpenAI({
            apiKey
        })
    }

    async chat(messages) {
        try {
            // const response = await this.openai.chat.completions.create({
            //     model: "gpt-4o",
            //     messages
            // });
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "o1-mini",
                messages
            }, this.config).then(data => data.data);



            // const res = [];
            // const stream = response.data;
            // for await (const chunk of stream) {
            //     // console.log(chunk);
            //     res.push(chunk.toString());
            // }
            //
            // const jsonObjectsArray = res.map((dataString) => {
            //     // удаляем лишние символы и разбиваем по 'data:'
            //     const parts = dataString.trim().split('data:')
            //
            //     // пропускаем элементы, которые не содержат JSON
            //     let jsonParts = parts.filter(part => part.trim().startsWith('{'));
            //
            //     // преобразуем каждый 'part' обратно в JSON
            //     return jsonParts.map((jsonPart) => {
            //         return JSON.parse(jsonPart);
            //     })
            // });
            // console.log(jsonObjectsArray)

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
        }
    }

    async transcription() {

    }
}

export const openai = new OpenAIApi(config.get('OPENAI_TOKEN'));