import {Markup, session, Telegraf} from 'telegraf';
import {message} from "telegraf/filters";
import {code} from "telegraf/format";
import {openai} from './services/openai.js';
import {escapeMarkdownV2} from "./utils/escaper.js";
import authMiddleware from "./middlewares/auth-middleware.js";
import mongoose from "mongoose";
import UserService from "./services/user-service.js";
import CompanyService from "./services/company-service.js";
import RequestService from "./services/request-service.js";
import Wallet from "./models/wallet-model.js"
import updateLastActivityMiddleware from "./middlewares/updateLastActivity-middleware.js";
import * as path from "node:path";
import {fileURLToPath} from 'url';
import * as fs from "node:fs/promises";
import {ogg} from "./ogg.js";
import {rateLimiter} from "./middlewares/rateLimiter-middleware.js";
import {resolve} from "path";
import {stability} from "./services/stability.js";
import {imageHelper} from "./imageHelper.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import {createPayment} from "./services/paymentService.js";
import express from "express";
import paymentRoutes from "./routes/paymentRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";


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

const WELCOME_MESSAGE = '\uD83C\uDF1F Добро пожаловать в наш бот! \uD83C\uDF1F\n\nПривет, я — ваш виртуальный помощник от FLX, созданный для того, чтобы облегчить вашу работу и сделать день продуктивнее. Вот чем я могу вам помочь:\n\n\uD83D\uDD39 Предоставление актуальной информации и ответов на ваши вопросы.\n\uD83D\uDD39 Помощь в организации рабочего времени и управлении задачами.\n\uD83D\uDD39 Предоставление полезных советов и рекомендаций.\n\uD83D\uDD39 Автоматизация рутинных процессов и задач.\n\nНе стесняйтесь обращаться ко мне за любой помощью или информацией. Я здесь, чтобы поддержать вас и помочь работать продуктивнее!'
const REGISTER_FORMAT = '\nроль\nusername телеграмм аккаунта';
const USERS_PER_PAGE = 5;

const bot = new Telegraf(process.env.TG_BOT_TOKEN);


const app = express();

// Middleware
app.use(express.json());
console.log("DOMAIN", process.env.BASE_URL_NO_PORT)
app.use(await bot.createWebhook({ domain: process.env.BASE_URL_NO_PORT }));

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
        console.error('Ошибка при записи файла или отправке сообщения:', error?.data);
        await ctx.reply('Произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте позже.');
        throw error;
    }
}

bot.catch(async (err, ctx) => {
    console.error('ERROR FROM CATCH', err);
    if (err.error?.code === 'insufficient_quota') {
        await ctx.reply('На вашем счете недостаточно средств!')
    }

    console.error(`Ошибка для пользователя ${ctx.from.id}:`, err.stack);
    logError(err);
});

bot.use(session());
bot.use(authMiddleware);
bot.use(updateLastActivityMiddleware);
const limiter = rateLimiter(2, 5);
bot.use(limiter);

bot.telegram.setMyCommands([
    {command: '/start', description: 'Начать общение'},
    {command: '/new', description: 'Сбросить контекст'},
    {command: '/register', description: 'Зарегистрировать нового пользователя'},
    {command: '/model_info', description: 'Настройка модели OpenAI'},
    {command: '/change_permission', description: 'Изменить разрешения пользователя'},
    {command: '/balance', description: 'Посмотреть баланс компании'},
    {command: '/show_users', description: 'Показать всех пользователей'},
    {command: '/delete', description: 'Удалить пользователя'}
]);

bot.command('new', async (ctx) => {
    ctx.session = {
        messages: [],
        systemMessages: []
    };
    await ctx.reply('Контекст сброшен! Жду вашего сообщения');
});

bot.command('show_users', async (ctx) => {
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

const TERMS_TEXT = `

Прежде чем мы начнём наше сотрудничество, пожалуйста, ознакомьтесь с условиями использования нашего бота:

⚡ *Документ 1:*  
Ссылка

🔒 *Документ 2:*  
Ссылка

⚖️ *Документ 3:*  
Ссылка

Нажимая кнопку **"Согласен"**, вы подтверждаете, что ознакомились с условиями и соглашаетесь с ними.
`;

bot.command('start', async (ctx) => {
    const tgId = ctx.from.id;
    const tgUsername = ctx.from.username;
    let welcomeMessage = (WELCOME_MESSAGE);

    // check user register
    const user = await UserService.getUser({telegramUsername: tgUsername});

    if (!user) {
        await ctx.reply(`\n ${process.env.NOT_REGISTERED}`);
        return;
    }

    const updatedUser = await UserService.updateUser({telegramUsername: tgUsername}, {telegramId: tgId});
    ctx.session = {
        messages: [],
        systemMessages: []
    };

    await ctx.reply(welcomeMessage);

    if (!user.termsAccepted) {
        return ctx.reply(TERMS_TEXT, Markup.inlineKeyboard([
            [Markup.button.callback('Согласен', 'accept_terms')]
        ]), { parse_mode: 'Markdown' });
    }

    if (!user.firstname || !user.lastname) {
        await ctx.reply('Для продолжения необходимо ввести имя и фамилию в следующем сообщении через пробел!');
        ctx.session.systemMessages.push({type: 'updateUser', data: ctx.message.text})
    }
});

bot.action('accept_terms', async (ctx) => {
    try {
        if (ctx.user && !ctx.user.termsAccepted) {
            await UserService.updateUser({telegramId: ctx.from.id.toString()}, {
                termsAccepted: true
            });
        }

        ctx.answerCbQuery(); // скрываем уведомление от кнопки
        return ctx.reply('Спасибо за ваше согласие! Теперь вы можете пользоваться ботом.', { parse_mode: 'Markdown' });
    } catch (err) {
        console.error(err);
        return ctx.reply('Ошибка при сохранении вашего согласия.');
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

// Команда /pay
bot.command('pay', async (ctx) => {
    ctx.session.systemMessages.push({type: 'pay', data: ctx.message.text})

    // Задаем сумму пополнения
    await ctx.reply('Введите сумму для пополнения:', Markup.inlineKeyboard([
        [Markup.button.callback('Отменить', 'close')]
    ]));
});

bot.command('balance', async (ctx) => {
   try {
       const company = ctx.user.company;
       const wallet = await Wallet.findOne({ company: company.id });

       const balance = parseFloat(wallet.balance.toString());
       const formattedBalance = balance.toLocaleString('ru-RU', {
           minimumFractionDigits: 2,
           maximumFractionDigits: 2
       });

       // Форматируем дату создания кошелька
       const updatedAtFormatted = new Date(wallet.updatedAt).toLocaleDateString('ru-RU', {
           day: 'numeric',
           month: 'long',
           year: 'numeric'
       });
       const message = `
🎉 *Ваш баланс успешно получен!* 🎉

💰 *Баланс:* ${formattedBalance} ${wallet.currency}
📅 *Дата последнего обновления кошелька:* ${updatedAtFormatted}

Спасибо, что пользуетесь нашим сервисом!
    `;

       return ctx.reply(message, { parse_mode: 'Markdown' });
   } catch (e) {
       throw e;
   }
});

// Константы
const ALL_PERMISSIONS = [
    'register', 'delete', 'show_users', 'text_messages', 'voice_messages',
    'model_info', 'change_model', 'image', 'upscale', 'outpaint',
    'replace', 'recolor', 'removebg', 'sketch', 'style', 'change_permission', 'new', 'pay', 'balance'
];

// Команда /change_permission
bot.command('change_permission', async (ctx) => {
    try {
        // Получаем текущего пользователя
        const currentUser = await UserService.getUser({telegramId: ctx.from.id.toString()});
        if (!currentUser) {
            return ctx.reply('❌ Пользователь не найден в системе.');
        }

        // Проверка, является ли пользователь администратором
        await currentUser.populate('roleId');
        if (currentUser.roleId.name !== 'admin') {
            return ctx.reply('🔒 У вас нет доступа к этой команде.');
        }

        // Получаем всех пользователей той же компании
        const companyName = currentUser.company.name;
        const allUsers = await UserService.getUsersWithRoles({'company.name': companyName}).then(data => data.filter(item => item.telegramId));

        if (allUsers.length === 0) {
            return ctx.reply('📭 В вашей компании нет пользователей для управления.');
        }

        // Разделяем пользователей на страницы
        const totalPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
        const pages = [];

        for (let i = 0; i < totalPages; i++) {
            const pageUsers = allUsers.slice(i * USERS_PER_PAGE, (i + 1) * USERS_PER_PAGE);
            pages.push(pageUsers);
        }

        // Сохраняем в сессии
        ctx.session.changePermission = {
            pages: pages,
            currentPage: 0,
            totalPages: totalPages,
        };

        // Отправляем первую страницу
        const firstPage = pages[0];
        const userButtons = firstPage.map(user => [
            Markup.button.callback(`${user.telegramId.toString()} (${user.telegramUsername})`, `select_user_${user._id}`)
        ]);

        const navigationButtons = [];
        if (totalPages > 1) {
            navigationButtons.push(Markup.button.callback('➡️ Вперед', `page_1`));
        }

        // Добавляем кнопку «Отмена» на всех этапах
        navigationButtons.push(Markup.button.callback('❌ Отмена', 'cancel_change_permission'));

        await ctx.reply(
            '🛠 **Выберите пользователя для изменения разрешений:**',
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([...userButtons, navigationButtons])
            }
        );

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Произошла ошибка при выполнении команды.');
    }
});

// Обработчик навигации по страницам
bot.action(/page_(\d+)/, async (ctx) => {
    try {
        const requestedPage = parseInt(ctx.match[1]); // Нулевая индексация
        const sessionData = ctx.session.changePermission;

        if (!sessionData) {
            return ctx.reply('❗ Сессия не найдена. Пожалуйста, начните заново команду /change_permission.');
        }

        if (requestedPage < 0 || requestedPage >= sessionData.totalPages) {
            return ctx.reply('❌ Недопустимая страница.');
        }

        // Обновляем текущую страницу в сессии
        sessionData.currentPage = requestedPage;

        const pageUsers = sessionData.pages[requestedPage];
        console.log(pageUsers);
        const userButtons = pageUsers.map(user => [
            Markup.button.callback(`${user.telegramId.toString()} (${user.telegramUsername})`, `select_user_${user._id}`)
        ]);

        const navigationButtons = [];

        if (sessionData.totalPages > 1) {
            if (requestedPage > 0) {
                navigationButtons.push(Markup.button.callback('⬅️ Назад', `page_${requestedPage - 1}`));
            }
            if (requestedPage < sessionData.totalPages - 1) {
                navigationButtons.push(Markup.button.callback('➡️ Вперед', `page_${requestedPage + 1}`));
            }
        }

        // Добавляем кнопку «Отмена»
        navigationButtons.push(Markup.button.callback('❌ Отмена', 'cancel_change_permission'));

        const pageNumber = requestedPage + 1;
        const totalPages = sessionData.totalPages;

        await ctx.editMessageText(
            `🛠 **Выберите пользователя для изменения разрешений (Страница ${pageNumber} из ${totalPages}):**`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([...userButtons, navigationButtons])
            }
        );

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Произошла ошибка при навигации по страницам.');
    }
});

// Обработчик выбора пользователя
bot.action(/select_user_(.+)/, async (ctx) => {
    try {
        const userId = ctx.match[1];
        const selectedUser = await UserService.getUserWithRole({_id: userId});

        if (!selectedUser) {
            return ctx.reply('❌ Пользователь не найден.');
        }

        const effectivePermissions = await selectedUser.getEffectivePermissions();

        // Кнопки для удаления разрешений
        const permissionButtons = effectivePermissions.map(perm => [
            Markup.button.callback(`❌ Удалить "${perm}"`, `remove_perm_${userId}_${perm}`)
        ]);

        // Разрешения, доступные для добавления
        const availableToAdd = ALL_PERMISSIONS.filter(perm => !effectivePermissions.includes(perm));

        const addButtons = availableToAdd.map(perm => [
            Markup.button.callback(`✅ Добавить "${perm}"`, `add_perm_${userId}_${perm}`)
        ]);

        // Сохраняем выбранного пользователя в сессии
        ctx.session.changePermission.selectedUser = {
            id: userId,
            telegramId: selectedUser.telegramId.toString(), // Можно заменить на более информативное поле, например, имя
        };

        await ctx.reply(
            `🔹 **Разрешения пользователя:**
${effectivePermissions.length > 0 ? effectivePermissions.join(', ') : 'Нет разрешений'}`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('➕ Добавить Разрешение', `show_add_${userId}`)],
                    ...permissionButtons,
                    [Markup.button.callback('🔙 Назад к списку пользователей', 'back_to_users')],
                    [Markup.button.callback('❌ Закрыть', 'cancel_change_permission')]
                ])
            }
        );

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Произошла ошибка при выборе пользователя.');
    }
});

// Обработчик добавления разрешения
bot.action(/add_perm_(.+)_(.+)/, async (ctx) => {
    try {
        const userId = ctx.match[1];
        const permission = ctx.match[2];

        const user = await UserService.getUser({_id: userId});
        if (!user) {
            return ctx.reply('❌ Пользователь не найден.');
        }

        // Проверяем, не добавлено ли уже разрешение
        if (user.customPermissions.add.includes(permission)) {
            return ctx.reply(`⚠️ Разрешение "${permission}" уже добавлено.`);
        }

        // Добавляем разрешение
        user.customPermissions.add.push(permission);
        // Убираем из remove, если там есть
        user.customPermissions.remove = user.customPermissions.remove.filter(perm => perm !== permission);
        await user.save();

        await ctx.answerCbQuery(`✅ Разрешение "${permission}" добавлено для пользователя.`);

        // Обновляем сообщение с разрешениями
        const effectivePermissions = await user.getEffectivePermissions();

        await ctx.editMessageText(
            `🔹 **Разрешения пользователя:**
${effectivePermissions.length > 0 ? effectivePermissions.join(', ') : 'Нет разрешений'}`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('➕ Добавить Разрешение', `show_add_${userId}`)],
                    ...effectivePermissions.map(perm => [
                        Markup.button.callback(`❌ Удалить "${perm}"`, `remove_perm_${userId}_${perm}`)
                    ]),
                    [Markup.button.callback('🔙 Назад к списку пользователей', 'back_to_users')],
                    [Markup.button.callback('❌ Закрыть', 'cancel_change_permission')] // Кнопка «Закрыть»
                ])
            }
        );

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Произошла ошибка при добавлении разрешения.');
    }
});

// Обработчик удаления разрешения
bot.action(/remove_perm_(.+)_(.+)/, async (ctx) => {
    try {
        const userId = ctx.match[1];
        const permission = ctx.match[2];

        const user = await UserService.getUser({_id: userId});
        if (!user) {
            return ctx.reply('❌ Пользователь не найден.');
        }

        // Проверяем, не удалено ли уже разрешение
        if (user.customPermissions.remove.includes(permission)) {
            return ctx.reply(`⚠️ Разрешение "${permission}" уже удалено.`);
        }

        // Добавляем разрешение в remove
        user.customPermissions.remove.push(permission);
        // Убираем из add, если там есть
        user.customPermissions.add = user.customPermissions.add.filter(perm => perm !== permission);
        await user.save();

        await ctx.answerCbQuery(`✅ Разрешение "${permission}" удалено для пользователя.`);

        // Обновляем сообщение с разрешениями
        const effectivePermissions = await user.getEffectivePermissions();

        await ctx.editMessageText(
            `🔹 **Разрешения пользователя:**
${effectivePermissions.length > 0 ? effectivePermissions.join(', ') : 'Нет разрешений'}`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('➕ Добавить Разрешение', `show_add_${userId}`)],
                    ...effectivePermissions.map(perm => [
                        Markup.button.callback(`❌ Удалить "${perm}"`, `remove_perm_${userId}_${perm}`)
                    ]),
                    [Markup.button.callback('🔙 Назад к списку пользователей', 'back_to_users')],
                    [Markup.button.callback('❌ Закрыть', 'cancel_change_permission')] // Кнопка «Закрыть»
                ])
            }
        );

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Произошла ошибка при удалении разрешения.');
    }
});

// Обработчик отображения доступных разрешений для добавления
bot.action(/show_add_(.+)/, async (ctx) => {
    try {
        const userId = ctx.match[1];
        const user = await UserService.getUserWithRole({_id: userId});
        if (!user) {
            return ctx.reply('❌ Пользователь не найден.');
        }

        const effectivePermissions = await user.getEffectivePermissions();
        const availableToAdd = ALL_PERMISSIONS.filter(perm => !effectivePermissions.includes(perm));

        if (availableToAdd.length === 0) {
            return ctx.reply('📭 Нет доступных разрешений для добавления.');
        }

        const addButtons = availableToAdd.map(perm => [
            Markup.button.callback(`✅ Добавить "${perm}"`, `add_perm_${userId}_${perm}`)
        ]);

        // Добавляем кнопку «Закрыть»
        addButtons.push([Markup.button.callback('❌ Закрыть', 'cancel_change_permission')]);

        await ctx.reply(
            '🆕 **Выберите разрешение для добавления:**',
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    ...addButtons,
                    [Markup.button.callback('🔙 Назад к разрешениям пользователя', 'back_to_user_permissions')]
                ])
            }
        );

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Произошла ошибка при отображении доступных разрешений.');
    }
});

// Обработчик возврата к разрешениям выбранного пользователя
bot.action('back_to_user_permissions', async (ctx) => {
    try {
        const selectedUser = ctx.session.changePermission.selectedUser;
        if (!selectedUser || !selectedUser.id) {
            return ctx.reply('❌ Информация о выбранном пользователе не найдена.');
        }

        const user = await UserService.getUserWithRole({_id: selectedUser.id});
        if (!user) {
            return ctx.reply('❌ Пользователь не найден.');
        }

        const effectivePermissions = await user.getEffectivePermissions();

        await ctx.editMessageText(
            `🔹 **Разрешения пользователя:**
${effectivePermissions.length > 0 ? effectivePermissions.join(', ') : 'Нет разрешений'}`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('➕ Добавить Разрешение', `show_add_${selectedUser.id}`)],
                    ...effectivePermissions.map(perm => [
                        Markup.button.callback(`❌ Удалить "${perm}"`, `remove_perm_${selectedUser.id}_${perm}`)
                    ]),
                    [Markup.button.callback('🔙 Назад к списку пользователей', 'back_to_users')],
                    [Markup.button.callback('❌ Закрыть', 'cancel_change_permission')] // Кнопка «Закрыть»
                ])
            }
        );

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Произошла ошибка при возврате к разрешениям пользователя.');
    }
});

// Обработчик возврата к списку пользователей
bot.action('back_to_users', async (ctx) => {
    try {
        const sessionData = ctx.session.changePermission;

        if (!sessionData) {
            return ctx.reply('❗ Сессия не найдена. Пожалуйста, начните заново команду /change_permission.');
        }

        const currentPage = sessionData.currentPage;
        const pageUsers = sessionData.pages[currentPage];
        const userButtons = pageUsers.map(user => [
            Markup.button.callback(`${user.telegramId.toString()} (${user.telegramUsername})`, `select_user_${user._id}`)
        ]);

        const navigationButtons = [];

        if (sessionData.totalPages > 1) {
            if (currentPage > 0) {
                navigationButtons.push(Markup.button.callback('⬅️ Назад', `page_${currentPage - 1}`));
            }
            if (currentPage < sessionData.totalPages - 1) {
                navigationButtons.push(Markup.button.callback('➡️ Вперед', `page_${currentPage + 1}`));
            }
        }

        // Добавляем кнопку «Закрыть»
        navigationButtons.push(Markup.button.callback('❌ Закрыть', 'cancel_change_permission'));

        const pageNumber = currentPage + 1;
        const totalPages = sessionData.totalPages;

        await ctx.editMessageText(
            `🛠 **Выберите пользователя для изменения разрешений (Страница ${pageNumber} из ${totalPages}):**`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([...userButtons, navigationButtons])
            }
        );

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Произошла ошибка при возврате к списку пользователей.');
    }
});

/**
 * Обработчик отмены процесса изменения разрешений
 */
bot.action('cancel_change_permission', async (ctx) => {
    try {
        // Очищаем данные процесса из сессии
        ctx.session.changePermission = null;

        // Отправляем сообщение об отмене
        await ctx.reply('🛑 Процесс изменения разрешений отменён.');

        // Можно также удалить сообщения с inline клавиатурами, если необходимо
        if (ctx.callbackQuery.message) {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
        }

    } catch (error) {
        console.error('Ошибка при отмене процесса:', error);
        ctx.reply('❌ Произошла ошибка при отмене процесса.');
    }
});


// // Обработчик для неизвестных действий
// bot.on('callback_query', async (ctx) => {
//     if (!ctx.callbackQuery) return;
//     await ctx.answerCbQuery('❗ Неизвестное действие.');
// });

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

bot.command('model_info', async (ctx) => {
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

bot.command('upscale', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };

    ctx.session.systemMessages.push({type: 'upscale', data: 'Upscale изображения'})
    await ctx.reply('Отправьте изображения. Обязательно оставьте галочку на сжатие')

});

bot.command('outpaint', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };

    ctx.session.systemMessages.push({type: 'outpaint', data: 'Outpaint изображения'})
    await ctx.reply('Отправьте изображения. Обязательно оставьте галочку на сжатие')

});

bot.command('replace', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };

    ctx.session.systemMessages.push({type: 'replace', data: 'Replace изображения'})
    await ctx.reply('Отправьте изображения. Обязательно оставьте галочку на сжатие')

});

bot.command('recolor', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };

    ctx.session.systemMessages.push({type: 'recolor', data: 'Recolor изображения'})
    await ctx.reply('Отправьте изображения. Обязательно оставьте галочку на сжатие')

});

bot.command('removebg', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };

    ctx.session.systemMessages.push({type: 'removebg', data: 'Remove background изображения'})
    await ctx.reply('Отправьте изображения. Обязательно оставьте галочку на сжатие')

});

bot.command('sketch', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };

    ctx.session.systemMessages.push({type: 'sketch', data: 'Sketch изображения'})
    await ctx.reply('Отправьте изображения. Обязательно оставьте галочку на сжатие')

});

bot.command('style', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };

    ctx.session.systemMessages.push({type: 'style', data: 'Style изображения'})
    await ctx.reply('Отправьте изображения. Обязательно оставьте галочку на сжатие')

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

async function payment(ctx) {
    try {
        if (!ctx.user.company.id) {
            return ctx.reply('У вашей компании нет привязанного кошелька.');
        }

        // Ожидаем ввода суммы
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount) || amount <= 0) {
            return ctx.reply('Пожалуйста, введите корректную сумму.');
        }

        const description = `Пополнение баланса пользователя ${ctx.user.telegramUsername}`;
        const response = await axios.post(`http://ch.flx-it.ru:8020/payment/create-payment`, {
            companyId: ctx.user.company.id,
            amount: amount,
            chatId: ctx.chat.id,
            description: description
        });

        const {confirmationUrl} = response.data;
        if (confirmationUrl) {
            await ctx.reply(`Пожалуйста, оплатите по ссылке: ${confirmationUrl}`);
        } else {
            await ctx.reply('Произошла ошибка при создании платежа. Пожалуйста, попробуйте позже.');
        }
    } catch (error) {
        console.error('Pay command error:', error);
        ctx.reply('Произошла ошибка при обработке запроса.');
    }
}

async function register(ctx) {
    const inputDataArr = ctx.message.text.split('\n');
    const data = {
        roleName: inputDataArr[0],
        companyName: await CompanyService.getCompanyNameByUserTgId(ctx.from.id.toString()),
        telegramUsername: inputDataArr[1].replace("@", "")
    }

    ctx.session.systemMessages.push({type: 'registerConfirm', data})
    const newUserText = `Роль: ${data.roleName}\nНазвание компании: ${data.companyName}\nТелеграмм username: ${data.telegramUsername}`;


    await ctx.reply(`Вы хотите зарегистрировать следующего пользователя?\n\n${newUserText}`,
        Markup.inlineKeyboard([
            [Markup.button.callback('Да', 'register')],
            [Markup.button.callback('Нет..', 'cancel')]
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

        const welcomeMessage = WELCOME_MESSAGE.replace(/(Добро пожаловать в наш бот)/, `$1, ${userInfo[0]} ${userInfo[1]}`);
        await ctx.reply(welcomeMessage);
        ctx.session.systemMessages = [];

    } catch (e) {
        console.log('Error from register action', e);
        await ctx.reply('Что-то пошло не так..\n' + e);
        console.log('Ошибка при удалении сообщения', err);
        throw e;
    }
}

async function downloadImageFromTgServers(ctx) {
    try {
        const photoArray = ctx.message.photo;
        if (photoArray.length > 0) {
            await ctx.reply(`Изображение принято! Обработка..`);
        }

        const photo = photoArray[photoArray.length - 1];
        const fileId = photo.file_id;

        const file = await ctx.telegram.getFile(fileId);
        console.log(file);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TG_BOT_TOKEN}/${file.file_path}`;

        const fileName = `photo_${fileId}.png`; // Вы можете изменить расширение в зависимости от типа изображения
        const filePath = path.resolve(__dirname, '../images/downloads', fileName);

        return await imageHelper.downloadImage(fileUrl, filePath);

        // return fileName;
    } catch (err) {
        console.log('Error while downloading image from tg servers', err);
        throw err;
    }
}

async function generateImage(ctx) {
    try {
        // add opportunity to choose output format
        const prompt = await openai.translateText(ctx.message.text, 'английский');
        await ctx.reply(`'${prompt}'\n Принято! Генерация изображения..`);
        const imageBuffer = await stability.generateImage(prompt, ctx.from.id.toString());

        const filename = ctx.from.id.toString() + '_' + new Date().toISOString();
        const imagePath = resolve(__dirname, '../images', `${filename}.png`)
        const image = await imageHelper.saveImageBuffer(imageBuffer, imagePath);

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

async function upscaleImage(ctx) {
    try {
        await ctx.reply(`Принято! Upscale изображения..`);
        const inputFile = await downloadImageFromTgServers(ctx);
        await ctx.replyWithPhoto({source: inputFile});

        const imageBuffer = await stability.upscaleImage(inputFile);

        const filename = ctx.from.id.toString() + '_' + new Date().toISOString();
        const imagePath = resolve(__dirname, '../images/upscale', `${filename}.png`)
        const outputImage = await imageHelper.saveImageBuffer(imageBuffer, imagePath);

        ctx.session.systemMessages = [];
        console.log(ctx.session);
        return outputImage;

    } catch (err) {
        console.log('Error from upscale image function', err.stack);
        throw err;
    }
}

async function outpaintImage(ctx) {
    try {
        await ctx.reply(`Принято! Outpaint изображения..`);
        const inputFile = await downloadImageFromTgServers(ctx);
        await ctx.replyWithPhoto({source: inputFile});

        const imageBuffer = await stability.outpaintImage(inputFile);

        const filename = ctx.from.id.toString() + '_' + new Date().toISOString();
        const imagePath = resolve(__dirname, '../images/outpaint', `${filename}.png`)
        const outputImage = await imageHelper.saveImageBuffer(imageBuffer, imagePath);

        ctx.session.systemMessages = [];
        console.log(ctx.session);
        return outputImage;

    } catch (err) {
        // console.log('Error from erase image function', err.stack);
        throw err;
    }
}

async function searchAndReplaceImage(ctx) {
    try {
        await ctx.reply(`Принято! Search and replace изображения..`);
        const inputFile = await downloadImageFromTgServers(ctx);
        await ctx.replyWithPhoto({source: inputFile});

        const imageBuffer = await stability.searchAndReplaceImage(inputFile);

        const filename = ctx.from.id.toString() + '_' + new Date().toISOString();
        const imagePath = resolve(__dirname, '../images/search-and-replace', `${filename}.png`)
        const outputImage = await imageHelper.saveImageBuffer(imageBuffer, imagePath);

        ctx.session.systemMessages = [];
        console.log(ctx.session);
        return outputImage;

    } catch (err) {
        // console.log('Error from erase image function', err.stack);
        throw err;
    }
}

async function searchAndRecolorImage(ctx) {
    try {
        await ctx.reply(`Принято! Search and recolor изображения..`);
        const inputFile = await downloadImageFromTgServers(ctx);
        await ctx.replyWithPhoto({source: inputFile});

        const imageBuffer = await stability.searchAndRecolorImage(inputFile);

        const filename = ctx.from.id.toString() + '_' + new Date().toISOString();
        const imagePath = resolve(__dirname, '../images/search-and-recolor', `${filename}.png`)
        const outputImage = await imageHelper.saveImageBuffer(imageBuffer, imagePath);

        ctx.session.systemMessages = [];
        console.log(ctx.session);
        return outputImage;

    } catch (err) {
        // console.log('Error from erase image function', err.stack);
        throw err;
    }
}

async function removeBackgroundImage(ctx) {
    try {
        await ctx.reply(`Принято! Remove background изображения..`);
        const inputFile = await downloadImageFromTgServers(ctx);
        await ctx.replyWithPhoto({source: inputFile});

        const imageBuffer = await stability.removeBackgroundImage(inputFile);

        const filename = ctx.from.id.toString() + '_' + new Date().toISOString();
        const imagePath = resolve(__dirname, '../images/remove-background', `${filename}.png`)
        const outputImage = await imageHelper.saveImageBuffer(imageBuffer, imagePath);

        ctx.session.systemMessages = [];
        console.log(ctx.session);
        return outputImage;

    } catch (err) {
        // console.log('Error from erase image function', err.stack);
        throw err;
    }
}

async function sketchImage(ctx) {
    try {
        await ctx.reply(`Принято! Sketch изображения..`);
        const inputFile = await downloadImageFromTgServers(ctx);
        await ctx.replyWithPhoto({source: inputFile});

        const imageBuffer = await stability.sketchImage(inputFile);

        const filename = ctx.from.id.toString() + '_' + new Date().toISOString();
        const imagePath = resolve(__dirname, '../images/sketch', `${filename}.png`)
        const outputImage = await imageHelper.saveImageBuffer(imageBuffer, imagePath);

        ctx.session.systemMessages = [];
        console.log(ctx.session);
        return outputImage;

    } catch (err) {
        // console.log('Error from erase image function', err.stack);
        throw err;
    }
}

async function styleImage(ctx) {
    try {
        await ctx.reply(`Принято! Style изображения..`);
        const inputFile = await downloadImageFromTgServers(ctx);
        await ctx.replyWithPhoto({source: inputFile});

        const imageBuffer = await stability.styleImage(inputFile);

        const filename = ctx.from.id.toString() + '_' + new Date().toISOString();
        const imagePath = resolve(__dirname, '../images/style', `${filename}.png`)
        const outputImage = await imageHelper.saveImageBuffer(imageBuffer, imagePath);

        ctx.session.systemMessages = [];
        console.log(ctx.session);
        return outputImage;

    } catch (err) {
        // console.log('Error from erase image function', err.stack);
        throw err;
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

bot.on('photo', async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };

    try {
        const lastSystemMessage = ctx.session.systemMessages[ctx.session.systemMessages.length - 1];

        if (lastSystemMessage?.type === 'upscale') {
            const outputImage = await upscaleImage(ctx);
            return await ctx.replyWithPhoto({source: outputImage});
        }

        if (lastSystemMessage?.type === 'outpaint') {
            const outputImage = await outpaintImage(ctx);
            return await ctx.replyWithPhoto({source: outputImage});
        }

        if (lastSystemMessage?.type === 'replace') {
            const outputImage = await searchAndReplaceImage(ctx);
            return await ctx.replyWithPhoto({source: outputImage});
        }

        if (lastSystemMessage?.type === 'recolor') {
            const outputImage = await searchAndRecolorImage(ctx);
            return await ctx.replyWithPhoto({source: outputImage});
        }

        if (lastSystemMessage?.type === 'removebg') {
            const outputImage = await removeBackgroundImage(ctx);
            return await ctx.replyWithPhoto({source: outputImage});
        }

        if (lastSystemMessage?.type === 'sketch') {
            const outputImage = await sketchImage(ctx);
            return await ctx.replyWithPhoto({source: outputImage});
        }

        if (lastSystemMessage?.type === 'style') {
            const outputImage = await styleImage(ctx);
            return await ctx.replyWithPhoto({source: outputImage});
        }


        // await ctx.replyWithPhoto({source: outputImage});

    } catch (err) {
        // console.log('Error from photo message', err);
        throw err;
    }
});

bot.on(message('text'), async (ctx) => {
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };
    let response;

    const session = await mongoose.startSession(); // Начало сессии для транзакции
    session.startTransaction();
    try {
        // console.log(ctx.from);
        const lastSystemMessage = ctx.session.systemMessages[ctx.session.systemMessages.length - 1];
        if (lastSystemMessage?.type === 'register') { // type?
            await register(ctx);
            await session.commitTransaction();
            session.endSession();
            return;
        }
        if (lastSystemMessage?.type === 'updateUser') {
            await updateUser(ctx);
            await session.commitTransaction();
            session.endSession();
            return;
        }
        if (lastSystemMessage?.type === 'delete') {
            await deleteUser(ctx);
            await session.commitTransaction();
            session.endSession();
            return;
        }

        if (lastSystemMessage?.type === 'image') {
            await generateImage(ctx);
            await session.commitTransaction();
            session.endSession();
            return;
        }

        if (lastSystemMessage?.type === 'pay') {
            await payment(ctx);
            await session.commitTransaction();
            session.endSession();
            return;
        }

        if (lastSystemMessage !== undefined) {
            await ctx.reply('Вы ввели текстовое сообщение. Отмена предыдущей операции..');
            ctx.session.systemMessages = [];
        }

        await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'));

        const user = ctx.user;
        const wallet = await Wallet.findOne({ company: user.company.id }).session(session);
        if (!wallet) {
            await ctx.reply('Кошелек компании не найден.');
            await session.abortTransaction();
            session.endSession();
            return;
        }

        // проверка наличия баланса в кошельке
        if (wallet.balance === undefined || wallet.balance === null) {
            await ctx.reply('У кошелька компании отсутствует баланс.');
            await session.abortTransaction();
            session.endSession();
            return;
        }

        const model = await UserService.getUserModel(ctx.from.id.toString());
        if (!model) {
            await ctx.reply('Модель пользователя не найдена.');
            await session.abortTransaction();
            session.endSession();
            return;
        }

        ctx.session.messages.push({role: openai.roles.USER, content: ctx.message.text})
        // await ctx.reply(JSON.stringify(ctx.session, null, 2));

        response = await openai.chat(ctx.session.messages, model.name);

        const { promptTokens, completionTokens, totalTokens } = response.tokens;
        const price = (promptTokens * model.inputPrice) + (completionTokens * model.outputPrice);

        const requestPrice = parseFloat(price.toString());

        // попытка списания средств атомарно с условием достаточности баланса
        const updatedWallet = await Wallet.findOneAndUpdate(
            {
                _id: wallet._id,
                balance: { $gte: requestPrice } // условие достаточности баланса
            },
            {
                $inc: { balance: -requestPrice },
                $set: { updatedAt: Date.now() }
            },
            { new: true, session }
        );

        if (!updatedWallet) {
            await ctx.reply('На кошельке компании недостаточно средств для выполнения запроса.');
            await session.abortTransaction();
            session.endSession();
            return;
        }

        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

        const splittedText = splitMessage(response.content, 4000);
        for await (const chunk of splittedText) {
            console.log('chunk length', chunk.length);
            await ctx.reply(chunk, {parse_mode: 'Markdown', disable_web_page_preview: true});
        }

        const requestRecord = await RequestService.create(
            model.name,
            user._id,
            user.company.id,
            ctx.message.text,
            response.content,
            promptTokens,
            completionTokens,
            totalTokens,
            mongoose.Types.Decimal128.fromString(requestPrice.toFixed(10)),
            { session }
        );

        // фиксация транзакции
        await session.commitTransaction();
        session.endSession();

    } catch (e) {
        // console.log('Error from text message', e);
        await session.abortTransaction();
        session.endSession();
        await writeToFileAndSend(ctx, response?.content);
        throw e;
    }
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

bot.action('cancel', async (ctx) => {
    await ctx.editMessageReplyMarkup();
    await ctx.editMessageText('Отмена действия..')

    setTimeout(async () => {
        await ctx.editMessageText('Отменено.');
    }, 1200)

    ctx.session.systemMessages = [];
});

app.use((req, res, next) => {
    console.log('Incoming request:', req.method, req.url, req.body, req.headers.referer);
    next();
});


app.use('/webhook', (req, res, next) => {
    console.log('Webhook request:', req.body);
    next();
});


// Маршруты
app.use('/payment', paymentRoutes);
app.use('/webhook', webhookRoutes);

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = 8020;

const start = async () => {
    await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log('Successfully connected to MongoDB');
    }).catch(err => {
        console.error('Error connecting to MongoDB', err);
    });

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

start();

// process.once('SIGINT', () => bot.stop('SIGINT'));
// process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;