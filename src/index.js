import {session, Telegraf, Markup} from 'telegraf';
import config from 'config';
import {message} from "telegraf/filters";
import {code} from "telegraf/format";
import {openai} from './services/openai.js';
import {escapeMarkdownV2} from "./utils/escaper.js";
import authMiddleware from "./middlewares/auth-middleware.js";
import mongoose from "mongoose";
import UserService from "./services/user-service.js";
import CompanyService from "./services/company-service.js";
import RequestService from "./services/request-service.js";
import updateLastActivityMiddleware from "./middlewares/updateLastActivity-middleware.js";
import * as path from "node:path";
import { fileURLToPath } from 'url';
import * as fs from "node:fs";


const AVAILABLE_MODELS = [
    {
        name: "OpenAI o1-preview",
        description: "новая модель для решения самых сложных задач путем рассуждений. Каждый запрос расходует 5 генераций",
        picture: "🍓"
    },
    {
        name: "OpenAI o1-mini",
        description: "новая модель для кода, математических и научных задач",
        picture: "🤖"
    },
    {
        name: "gpt-4o",
        description: "умная и быстрая модель OpenAI для работы с текстами",
        picture: "🔥"
    },
    {
        name: "gpt-4o-mini",
        description: "быстрая и доступная модель OpenAI для повседневных задач",
        picture: "✔️"
    },
]

const REGISTER_FORMAT = '\nроль\nusername телеграмм аккаунта'

const bot = new Telegraf(config.get('TG_BOT_TOKEN'));

// Путь к файлу логов
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFilePath = path.join(__dirname, 'error.log');

// Функция для записи ошибок в файл с временной меткой
function logError(error) {
    const errorMessage = `[${new Date().toISOString()}] ${error.stack || error}\n`;
    fs.appendFile(logFilePath, errorMessage, (err) => {
        if (err) {
            console.error('Не удалось записать ошибку в файл логов:', err);
        }
    });
}
bot.catch((err, ctx) => {
    console.error(`Ошибка для пользователя ${ctx.from.id}:`, err);
    logError(err);
});

bot.use(session());
bot.use(authMiddleware);
bot.use(updateLastActivityMiddleware);

bot.telegram.setMyCommands([
    {command: '/start', description: 'Начать общение'},
    {command: '/register', description: 'Зарегистрировать нового пользователя'},
    {command: '/model', description: 'Настройка модели OpenAI'},
    {command: '/new', description: 'Сбросить контекст'},
    {command: '/showusers', description: 'Показать всех пользователей'},
    {command: '/delete', description: 'Удалить пользователя'}
]);

bot.command('new', async (ctx) => {
    ctx.session = {
        messages: [],
        systemMessages: []
    };
    await ctx.reply('Контекст сброшен! Жду вашего сообщения');
});

bot.command('showusers', async (ctx) => {
    const currentUser = await UserService.getUser({telegramId: ctx.from.id.toString()});
    const users = await UserService.getUsers({'company.name': currentUser.company.name});

    if (users.length === 0) {
        await ctx.reply('Список пользователей пуст.');
        return;
    }

    const messages = users.map((user, index) => {
        return `
*Пользователь ${index + 1}:*
*Имя:* ${escapeMarkdownV2(user.firstname)}
*Фамилия:* ${escapeMarkdownV2(user.lastname)}
*Username:* @${escapeMarkdownV2(user.telegramUsername)}
*Компания:* ${escapeMarkdownV2(user.company.name)}
*Последняя активность:* ${user.lastActivity}
*Активен:* ${user.isActive ? 'Да' : 'Нет'}
    `;
    });

    const fullMessage = messages.join('\n---\n');

    await ctx.reply(fullMessage, { parse_mode: 'Markdown' });

});

bot.command('start', async (ctx) => {
    const tgId = ctx.from.id;
    const tgUsername = ctx.from.username;
    let welcomeMessage = (config.get('WELCOME_MESSAGE'));

    // check user register
    const user = await UserService.getUser({telegramUsername: tgUsername});

    if (!user) {
        await ctx.reply(welcomeMessage + `\n ${config.get('NOT_REGISTERED')}`);
        return;
    }

    const updatedUser = await UserService.updateUser({telegramUsername: tgUsername}, {telegramId: tgId});
    ctx.session = {
        messages: [],
        systemMessages: []
    };

    await ctx.reply(welcomeMessage);

    if (!user.firstname || !user.lastname) {
        await ctx.reply('Для продолжения необходимо ввести имя и фамилию в следующем сообщении через пробел!');
        ctx.session.systemMessages.push({type: 'updateUser', data: ctx.message.text})
    }
});

bot.command('register', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };
    ctx.session.systemMessages.push({type: 'register', data: ctx.message.text})

    const systemMessage = await ctx.reply(code(`Регистрация нового пользователя..`));
    setTimeout(() => {
        ctx.deleteMessage(systemMessage.message_id).catch((err) => console.log('Ошибка при удалении сообщения', err));
    }, 2500)
    await ctx.reply('Введите данные пользователя в формате\n' + REGISTER_FORMAT,
        Markup.inlineKeyboard([
            [Markup.button.callback('Отменить', 'close')]
        ]))
});
// вместо проверки контекста на каждой команде лучше добавить в middleware?
bot.command('delete', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };
    ctx.session.systemMessages.push({type: 'delete', data: ctx.message.text});
    await ctx.reply('Введите username пользователя',
        Markup.inlineKeyboard([
            [Markup.button.callback('Отменить', 'close')]
        ]))
});

bot.command('model', async (ctx) => {
    // const
    const currentModel = await UserService.getUserModel(ctx.from.id.toString());
    let welcomeMessage = `Добро пожаловать в настройки ChatGPT!\n\nЗдесь вы можете настроить модель по своему усмотрению для более эффективного взаимодействия.\n
Текущая модель: ${currentModel?.name}.\n\nДоступные модели:\n\n`;
    AVAILABLE_MODELS.forEach(model => {
        welcomeMessage += `${model.picture} ${model.name} — ${model.description}.\n\n`
    })

    await ctx.reply(welcomeMessage,
        Markup.inlineKeyboard([
            [Markup.button.callback('Выбрать другую модель', 'changeModel')],
            [Markup.button.callback('Закрыть', 'close')],
        ]));
});

bot.action('changeModel', async (ctx) => {
    console.log(ctx.update.callback_query.message.text);

    const modelButtons = AVAILABLE_MODELS.map(model => {
        return [Markup.button.callback(model.name, `setModel_${model.name}`)]
    });

    await ctx.editMessageText(ctx.update.callback_query.message.text, Markup.inlineKeyboard(modelButtons));
    // await ctx.editMessageText(availableModels);
});

bot.action(/setModel_(.+)/, async (ctx) => {
    const selectedModel = ctx.match[1].replace("OpenAI", "").trim();

    // await ctx.editMessageText(`Вы выбрали модель: ${selectedModel}`);
    const response = await UserService.setUserModel(ctx.from.id.toString(), selectedModel);

    if (response) {
        await ctx.editMessageText(`Успешно! Вы выбрали модель: ${selectedModel}.`);
    } else {
        await ctx.editMessageText(`Something wrong..`);
    }
    // console.log(response);
});

bot.action('close', async (ctx) => {
    if (ctx.session) {
        ctx.session.systemMessages = [];
    }

    await ctx.editMessageReplyMarkup();
    await ctx.editMessageText("Действие отменено.");
});

function splitMessage(text, maxLength = 4096) {
    const messages = [];
    let current = '';
    let inCodeBlock = false; // Флаг для отслеживания состояния блока кода

    // Разделяем текст на строки для более безопасного разбиения
    const lines = text.split('\n');

    for (let line of lines) {
        const codeBlockRegex = /^```/; // Регулярное выражение для обнаружения начала/конца блока кода

        // Проверяем, является ли текущая строка началом или концом блока кода
        if (codeBlockRegex.test(line.trim())) {
            inCodeBlock = !inCodeBlock;
        }

        // Предполагаем, что добавление этой строки не превышает лимит
        let addedLength = line.length + 1; // +1 для символа переноса строки

        // Если текущий текст не пустой, учитываем символ переноса строки
        if (current.length > 0) {
            addedLength = line.length + 1; // '\n' + line
        } else {
            addedLength = line.length;
        }

        // Проверяем, превышает ли добавление этой строки лимит
        if ((current.length + addedLength) > maxLength) {
            // Если мы находимся внутри блока кода, нам нужно закрыть его перед разбиением
            if (inCodeBlock) {
                current += '\n```'; // Закрываем блок кода
                messages.push(current);
                current = '```'; // Открываем новый блок кода в следующем сообщении
            } else {
                // Если не внутри блока кода, просто добавляем текущее сообщение
                if (current.length > 0) {
                    messages.push(current);
                    current = '';
                }
            }

            // Если строка сама по себе длиннее лимита, необходимо её дополнительно разбить
            while (line.length > maxLength) {
                const part = line.substring(0, maxLength);
                messages.push(part);
                line = line.substring(maxLength);
            }
        }

        // Добавляем строку к текущему сообщению с учётом переноса строки
        current += (current.length > 0 ? '\n' : '') + line;
    }

    // Если после цикла остался текст, добавляем его в сообщения
    if (current.length > 0) {
        // Если мы находимся внутри блока кода, закрываем его
        if (inCodeBlock) {
            current += '\n```';
        }
        messages.push(current);
    }

    return messages;
}

async function register(ctx) {
    const inputDataArr = ctx.message.text.split('\n');
    const data = {
        roleName: inputDataArr[0],
        companyName: await CompanyService.getCompanyNameByUserTgId(ctx.from.id.toString()),
        telegramUsername: inputDataArr[1]
    }

    ctx.session.systemMessages.push({type: 'registerConfirm', data})
    const newUserText = `Роль: ${data.roleName}\nНазвание компании: ${data.companyName}\nТелеграмм username: ${data.telegramUsername}`;


    await ctx.reply(`Вы хотите зарегистрировать следующего пользователя?\n\n${newUserText}`,
        Markup.inlineKeyboard([
            [Markup.button.callback('Да', 'register')],
            [Markup.button.callback('Нет..', 'registerCancel')]
        ]));
    // ctx.session.messages.pop(); // очистка контекста
}

async function deleteUser(ctx) {
    const username = await ctx.message.text;

    const user = await UserService.getUser({telegramUsername: username});
    if (!user) {
        return await ctx.editMessageText('Такого пользователя не существует. Отмена действия..');
    }
    const res = await UserService.deleteUser({telegramUsername: username});
    if (res.deletedCount === 1) {
        await ctx.reply(`Пользователь ${user.telegramUsername} успешно удален!`)
    } else {
        await ctx.reply('Что-то пошло не так..')
    }
}

async function updateUser(ctx) {
    const regex = /^[A-Za-zА-Яа-яЁё]+ [A-Za-zА-Яа-яЁё]+$/; // два слова через один пробел, состоящие только из латинских букв и кириллицы

    try {
        if (!regex.test(ctx.message.text)) {
            return await ctx.reply('Неправильный ввод данных! Попробуйте снова\n\nВведите имя и фамилию через пробел (допустимы только латинские буквы и кириллица)',
                Markup.inlineKeyboard([
                    [Markup.button.callback('Отменить действие', 'close')]
                ]));
        }
        const userInfo = ctx.message.text.split(' ');
        const updatedUser = await UserService.updateUser({telegramId: ctx.from.id.toString()}, {
            firstname: userInfo[0],
            lastname: userInfo[1]
        });

        const sysMessage = await ctx.reply(`Информация обновлена!`);
        setTimeout(() => {
            ctx.deleteMessage(sysMessage.message_id).catch((err) => console.log('Ошибка при удалении сообщения', err));
        }, 2500);

        const welcomeMessage = config.get('WELCOME_MESSAGE').replace(/(Добро пожаловать в наш бот)/, `$1, ${userInfo[0]} ${userInfo[1]}`);
        await ctx.reply(welcomeMessage);
        ctx.session.systemMessages = [];

    } catch (e) {
        console.log('Error from register action', e);
        await ctx.reply('Что-то пошло не так..\n' + e);
    }
}

bot.on(message('text'), async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };
    try {
        // console.log(ctx.from);
        const lastSystemMessage = ctx.session.systemMessages[ctx.session.systemMessages.length - 1];
        if (lastSystemMessage?.type === 'register') { // type?
            await register(ctx);
            return;
        }
        if (lastSystemMessage?.type === 'updateUser') {
            await updateUser(ctx);
            return;
        }
        if (lastSystemMessage?.type === 'delete') {
            await deleteUser(ctx);
            return;
        }

        await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'));
        // await ctx.reply(code(`Ваш запрос: ${ctx.message.text}`))
        // await ctx.reply(JSON.stringify(ctx.message, null, 2));
        ctx.session.messages.push({role: openai.roles.USER, content: ctx.message.text})
        // const messages = [{role: openai.roles.USER, content: ctx.message.text}];
        // await ctx.reply(JSON.stringify(ctx.session, null, 2));

        const model = await UserService.getUserModel(ctx.from.id.toString());
        console.log('MODEL', model);
        // console.log('request with model ', model)
        const response = await openai.chat(ctx.session.messages, model.name);

        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

        // const text = escapeMarkdownV2(response.content);
        // console.log(text.length);

        const splittedText = splitMessage(response.content, 4096);
        for await (const chunk of splittedText) {
            await ctx.reply(chunk, {parse_mode: "Markdown"});
        }

        // Экранирование специальных символов MarkdownV2
        // const escapedText = escapeMarkdown(response.content);

        // Разбиение текста на части
        // const messages = splitMessage(text, 4096);

        // Отправка сообщений с учетом MarkdownV2 и задержкой
        // await sendMessages(ctx, messages, 'MarkdownV2');

        const user = await UserService.getUser({telegramId: ctx.from.id.toString()});
        // const model = await ModelService.getModelById(user.modelId);
        const request = await RequestService.create(
            model.name,
            ctx.message.text,
            response.content,
            response.tokens.promptTokens,
            response.tokens.completionTokens,
            response.tokens.totalTokens,
            (response.tokens.promptTokens * model.inputPrice) + (response.tokens.completionTokens * model.outputPrice)
        );
        // console.log(request);

    } catch (e) {
        console.log('Error from text message', e)
    }
});

bot.action('register', async (ctx) => {
    try {
        await ctx.editMessageReplyMarkup();
        await ctx.reply('Процесс регистрации нового пользователя..');

        const userData = ctx.session.systemMessages.pop().data;
        const response = await UserService.register(userData.roleName, userData.companyName, userData.telegramUsername);

        await ctx.reply(`Пользователь успешно зарегистрирован!`)
        ctx.session.systemMessages = [];

    } catch (e) {
        console.log('Error from register action', e);
        await ctx.reply('Отказано!\n' + e);
    }
});

bot.action('registerCancel', async (ctx) => {
    await ctx.editMessageReplyMarkup();
    await ctx.editMessageText('Отмена регистрации..')

    setTimeout(async () => {
        await ctx.editMessageText('Отменено.');
    }, 1200)

    ctx.session.systemMessages = [];
});

const start = async () => {
    await mongoose.connect(config.get("MONGO_URI"), {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log('Successfully connected to MongoDB');
    }).catch(err => {
        console.error('Error connecting to MongoDB', err);
    })

    bot.launch();
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));