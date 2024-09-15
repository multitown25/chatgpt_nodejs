import {session, Telegraf} from 'telegraf';
import config from 'config';
import {message} from "telegraf/filters";
import {code} from "telegraf/format";
import {openai} from './openai.js';
import { SocksProxyAgent } from 'socks-proxy-agent';


const INITIAL_SESSION = {
    messages: []
}

// 85.143.44.220:64719:GXjt8nK3:ghhPdd4C
const bot = new Telegraf(config.get('TG_BOT_TOKEN'), {
    telegram: {
        agent: new SocksProxyAgent('socks://GXjt8nK3:ghhPdd4C@185.222.214.128:64487')}
});

bot.use(session());
bot.launch();

bot.command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION;
    await ctx.reply('Жду вашего сообщения')
})

bot.on(message('text'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION;
    try {
        await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'));
        await ctx.reply(code(`Ваш запрос: ${ctx.message.text}`))
        // await ctx.reply(JSON.stringify(ctx.message, null, 2));
        const messages = [{role: openai.roles.USER, content: ctx.message.text}];
        const response = await openai.chat(messages);
        await ctx.reply(response);


    } catch (e) {
        console.log('Error from text message', e.message)
    }
})

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));