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
import {fileURLToPath} from 'url';
import * as fs from "node:fs/promises";
import redis from "redis";
import {marked} from 'marked';
import {removeFile} from "./utils/removeFile.js";
import {ogg} from "./ogg.js";
import {rateLimiter} from "./middlewares/rateLimiter-middleware.js";
import {dirname, resolve} from "path";
import {stability} from "./services/stability.js";
import {imageHelper} from "./imageHelper.js";


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

const REGISTER_FORMAT = '\nроль\nusername телеграмм аккаунта';
const USERS_PER_PAGE = 5;

const bot = new Telegraf(config.get('TG_BOT_TOKEN'));

// Путь к файлу логов
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFilePath = path.join(__dirname, 'error.log');

// Папка для сохранения длинных сообщений
const MESSAGES_DIR = path.join(__dirname, 'messages');
// Функция для инициализации папки, если она не существует
const initialize = async () => {
    try {
        await fs.mkdir(MESSAGES_DIR, {recursive: true});
        console.log(`Папка для сообщений создана или уже существует: ${MESSAGES_DIR}`);
    } catch (error) {
        console.error('Ошибка при создании папки для сообщений:', error);
    }
};

// Вызов инициализации при запуске
initialize();


// Функция для записи ошибок в файл с временной меткой
async function logError(error) {
    const errorMessage = `[${new Date().toISOString()}] ${error.stack || error}\n`;
    await fs.appendFile(logFilePath, errorMessage, (err) => {
        if (err) {
            console.error('Не удалось записать ошибку в файл логов:', err);
        }
    });
}

async function writeToFileAndSend(ctx, messageText) {
    const timestamp = Date.now();
    const userId = ctx.from.id;
    const filename = `message_${userId}_${timestamp}.txt`;
    const filepath = path.join(MESSAGES_DIR, filename);

    try {
        // Запись сообщения в файл
        await fs.writeFile(filepath, messageText, 'utf-8');
        console.log(`Сообщение записано в файл: ${filepath}`);

        await ctx.replyWithDocument({source: filepath}, {caption: 'Ваше длинное сообщение сохранено и отправлено в файл.'});
    } catch (error) {
        console.error('Ошибка при записи файла или отправке сообщения:', error);
        await ctx.reply('Произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте позже.');
        throw error;
    }
}

bot.catch((err, ctx) => {
    console.error(`Ошибка для пользователя ${ctx.from.id}:`, err);
    logError(err);
});

bot.use(session());
bot.use(authMiddleware);
bot.use(updateLastActivityMiddleware);
const limiter = rateLimiter(2, 5);
bot.use(limiter);

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
    try {
        const currentUser = await UserService.getUser({telegramId: ctx.from.id.toString()});
        const users = await UserService.getUsers({'company.name': currentUser.company.name});

        if (users.length === 0) {
            await ctx.reply('Список пользователей пуст.');
            return;
        }

        // Функция для создания сообщения для конкретной страницы
        const generateMessage = (page) => {
            const start = page * USERS_PER_PAGE;
            const end = start + USERS_PER_PAGE;
            const paginatedUsers = users.slice(start, end);

            const messages = paginatedUsers.map((user, index) => {
                const userIndex = start + index + 1;
                return `
*Пользователь ${userIndex}:*
*Имя:* ${escapeMarkdownV2(user.firstname)}
*Фамилия:* ${escapeMarkdownV2(user.lastname)}
*Username:* @${escapeMarkdownV2(user.telegramUsername)}
*Компания:* ${escapeMarkdownV2(user.company.name)}
*Последняя активность:* ${user.lastActivity}
*Активен:* ${user.isActive ? 'Да' : 'Нет'}
                `;
            });

            const fullMessage = messages.join('\n---\n');
            return fullMessage;
        };

        const totalPages = Math.ceil(users.length / USERS_PER_PAGE);
        let currentPage = 0;

        const createKeyboard = (page) => {
            const buttons = [];

            if (page > 0) {
                buttons.push(Markup.button.callback('◀️ Назад', `prev_${page}`));
            } else {
                buttons.push(Markup.button.callback('◀️ Назад', 'noop'));
            }

            buttons.push(Markup.button.callback(`Страница ${page + 1} из ${totalPages}`, 'noop'));

            if (page < totalPages - 1) {
                buttons.push(Markup.button.callback('Вперёд ▶️', `next_${page}`));
            } else {
                buttons.push(Markup.button.callback('Вперёд ▶️', 'noop'));
            }

            return Markup.inlineKeyboard([buttons]);
        };

        // Отправка первого сообщения с первой страницей
        await ctx.reply(generateMessage(currentPage), {
            parse_mode: 'Markdown',
            ...createKeyboard(currentPage)
        });

        // Обработка нажатий кнопок
        bot.action(/(next|prev)_(\d+)/, async (ctx) => {
            const action = ctx.match[1];
            const page = parseInt(ctx.match[2]);

            let newPage;
            if (action === 'next') {
                newPage = page + 1;
                if (newPage >= totalPages) {
                    newPage = totalPages - 1;
                }
            } else if (action === 'prev') {
                newPage = page - 1;
                if (newPage < 0) {
                    newPage = 0;
                }
            }

            await ctx.editMessageText(generateMessage(newPage), {
                parse_mode: 'Markdown',
                ...createKeyboard(newPage)
            });

            await ctx.answerCbQuery();
        });

        // Опционально: Обработка кнопки без действия (noop)
        bot.action('noop', (ctx) => {
            ctx.answerCbQuery();
        });

    } catch (error) {
        console.error(error);
        await ctx.reply('Произошла ошибка при получении списка пользователей.');
    }
});

bot.command('start', async (ctx) => {
    const tgId = ctx.from.id;
    const tgUsername = ctx.from.username;
    let welcomeMessage = (config.get('WELCOME_MESSAGE'));

    // check user register
    const user = await UserService.getUser({telegramUsername: tgUsername});

    if (!user) {
        await ctx.reply(`\n ${config.get('NOT_REGISTERED')}`);
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
        ctx.deleteMessage(systemMessage.message_id).catch((err) => {
            console.log('Ошибка при удалении сообщения', err);
            throw err;
        });
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

bot.command('test', async (ctx) => {
    console.log('next')
    await ctx.reply('Заключение');
    // await ctx.replyWithMarkdown('### Заключение');
    // await ctx.reply('### Заключение');
});


bot.command('image', async (ctx) => {
    console.log(typeof ctx.from.id);
    console.log(ctx.from.id.toString());

    ctx.session ??= {
        messages: [],
        systemMessages: []
    };
    ctx.session.systemMessages.push({type: 'image', data: 'Генерация изображения'})

    await ctx.reply('Введите запрос для генерации изображения')

});

async function generateImage(ctx) {


    try {
        // add opportunity to choose output format
        const prompt = await openai.translateText(ctx.message.text, 'английский');
        await ctx.reply(`'${prompt}'\n Принято! Генерация изображения..`);
        const imageBuffer = await stability.generateImage(prompt);

        const filename = ctx.from.id.toString() + '_' + new Date().toISOString();
        const imagePath = resolve(__dirname, '../images', `${filename}.png`)
        const image = await imageHelper.saveImage(imageBuffer, imagePath);

        await ctx.replyWithPhoto({source: image});
        ctx.session.systemMessages = [];
        console.log(ctx.session);

    } catch (err) {
        console.log('Error from /image command', err);

        if (err.response?.status === 403) {
            await ctx.reply('Ошибка при генерации изображения. Система модерации контента Stability AI отметила некоторую часть вашего запроса и впоследствии отклонила его.')
        }
        throw err;
    }
}

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
    const tagStack = []; // Стек для отслеживания открытых Markdown-элементов

    // Маппинг открывающих и закрывающих символов Markdown
    const markdownTags = {
        '```': 'codeBlock',                 // Блок кода
        '`': 'inlineCode',                  // Встраиваемый код
        '**': 'bold',                       // Жирный текст
        '*': 'italic',                      // Курсив
        '~~': 'strikethrough',              // Зачеркнутый текст
        '[]()': 'link',                     // Ссылка
        '![]()': 'image',                   // Изображение
    };

    // Функция для получения закрывающих символов из стека
    function closeTags() {
        let closing = '';
        while (tagStack.length > 0) {
            const tag = tagStack.pop();
            for (const key in markdownTags) {
                if (markdownTags[key] === tag) {
                    closing += key;
                    break;
                }
            }
        }
        return closing;
    }

    // Функция для открытия тегов из стека
    function openTags() {
        let opening = '';
        tagStack.forEach(tag => {
            for (const key in markdownTags) {
                if (markdownTags[key] === tag) {
                    opening += key;
                    break;
                }
            }
        });
        return opening;
    }

    // Разделяем текст на строки для более безопасного разбиения
    const lines = text.split('\n');

    for (let originalLine of lines) {
        let line = originalLine;
        let i = 0;

        while (i < line.length) {
            let matched = false;

            const tags = Object.keys(markdownTags);
            // Проверяем наличие многосимвольных тегов (``` , **, ~~)
            for (const tag of tags) {
                if (line.startsWith(tag, i)) {
                    const currentTag = markdownTags[tag];
                    const lastTag = tagStack[tagStack.length - 1];

                    if (lastTag === currentTag) {
                        // Закрываем тег
                        current += tag;
                        tagStack.pop();
                    } else {
                        // Открываем тег
                        current += tag;
                        tagStack.push(currentTag);
                    }
                    i += tag.length;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // Добавляем текущий символ
                current += line[i];
                i++;
            }

            // Проверка на превышение лимита после добавления символа или тега
            if (current.length >= maxLength) {
                // Закрываем все открытые теги перед разбиением
                current += closeTags();
                messages.push(current);
                current = '';

                // Открываем заново те же теги для следующего сообщения
                current += openTags();
            }
        }

        // Добавляем перенос строки
        current += '\n';

        // Проверка после добавления строки
        if (current.length > maxLength) {
            // Закрываем все открытые теги перед разбиением
            current += closeTags();
            messages.push(current);
            current = '';
            // Открываем заново те же теги для следующего сообщения
            current += openTags();
        }
    }

    // Добавляем оставшийся текст
    if (current.length > 0) {
        // Закрываем оставшиеся теги
        current += closeTags();
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
            ctx.deleteMessage(sysMessage.message_id).catch((err) => {
                console.log('Ошибка при удалении сообщения', err);
                throw err;
            });
        }, 2500);

        const welcomeMessage = config.get('WELCOME_MESSAGE').replace(/(Добро пожаловать в наш бот)/, `$1, ${userInfo[0]} ${userInfo[1]}`);
        await ctx.reply(welcomeMessage);
        ctx.session.systemMessages = [];

    } catch (e) {
        console.log('Error from register action', e);
        await ctx.reply('Что-то пошло не так..\n' + e);
        console.log('Ошибка при удалении сообщения', err);
        throw e;
    }
}

bot.on(message('voice'), async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };
    try {
        await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'))
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const userId = String(ctx.message.from.id)
        const oggPath = await ogg.create(link.href, userId);
        // console.log('oggPath', oggPath);
        const mp3Path = await ogg.toMp3(oggPath, userId);
        // console.log('mp3Path', mp3Path);
        // removeFile(oggPath);
        const text = await openai.transcription(mp3Path)
        await ctx.reply(code(`Ваш запрос: ${text}`));
        ctx.session.messages.push({role: openai.roles.USER, content: text})
        const model = await UserService.getUserModel(ctx.from.id.toString());
        const response = await openai.chat(ctx.session.messages, model.name);
        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})
        await ctx.reply(response.content);
    } catch (e) {
        console.error(`Error while proccessing voice message`, e.message)
    }
})

bot.on(message('text'), async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };
    let response;
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
        console.log('LAST SYSTEM MESSAGE', lastSystemMessage);
        if (lastSystemMessage?.type === 'image') {
            await generateImage(ctx);
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
        response = await openai.chat(ctx.session.messages, model.name);

        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

        // const text = escapeMarkdownV2(response.content);
        // console.log(text.length);

        const splittedText = splitMessage(response.content, 4000);
        for await (const chunk of splittedText) {
            console.log('chunk length', chunk.length);
            await ctx.reply(chunk, {parse_mode: 'Markdown', disable_web_page_preview: true});
        }

        // console.log(response.content.length)
        // await ctx.reply(response.content);
        const user = await UserService.getUser({telegramId: ctx.from.id.toString()});
        console.log('USER', user);
        // const model = await ModelService.getModelById(user.modelId);
        const request = await RequestService.create(
            model.name,
            user._id,
            ctx.message.text,
            response.content,
            response.tokens.promptTokens,
            response.tokens.completionTokens,
            response.tokens.totalTokens,
            (response.tokens.promptTokens * model.inputPrice) + (response.tokens.completionTokens * model.outputPrice)
        );
        // console.log(request);

    } catch (e) {
        console.log('Error from text message', e);
        await writeToFileAndSend(ctx, response?.content);
        throw e;
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
        console.log('Ошибка при удалении сообщения', err);
        throw e;
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
    });


    bot.launch();
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));