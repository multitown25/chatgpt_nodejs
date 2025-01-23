import User from '../models/user-model.js'

export default async function authMiddleware(ctx, next) {
    const command = ctx.update?.message?.text;
    console.log('command', command);
    if (command === '/start') {
        return next();
    }
    if (!ctx.from) {
        ctx.reply(`!ctx.from: ${JSON.stringify(ctx.from)}`);
        return ctx.reply('Unauthorized access.')
    }

    const user = await User.findOne({telegramUsername: ctx.from.username});

    if (!user) {
        return ctx.reply(`Доступ запрещен!`);
    }

    console.log('ctx.update', ctx.update);
    ctx.user = user;
    ctx.session ??= {
        messages: [],
        systemMessages: []
    };

    console.log('ctx.session?.systemMessages', ctx.session?.systemMessages);
    if(!user.firstname || !user.lastname) {
        if (ctx.session?.systemMessages?.pop()?.type === 'updateUser') {
            ctx.session.systemMessages.push({type: 'updateUser', data: ctx.message?.text});
            return next();
        }
        return ctx.reply('Для взаимодействия с ботом Вам необходимо ввести имя и фамилию! Команда /start');
    }

    const userPerms = await user.getEffectivePermissions();
    console.log(userPerms);
    if (command?.startsWith('/')) {
        if (!userPerms.includes(command.split('/')[1])) {
            return ctx.reply(`У вас нет прав для выполнения этой операции. Доступ запрещен!`);
        }
    }

    return next();
}