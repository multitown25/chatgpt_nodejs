import User from '../models/user-model.js'

export default async function authMiddleware(ctx, next) {
    if (ctx.update?.message?.text === '/start') {
        return next();
    }
    if (!ctx.from) {
        ctx.reply(`!ctx.from: ${JSON.stringify(ctx.from)}`);
        return ctx.reply('Unauthorized access.')
    }

    const user = await User.findOne({telegramId: ctx.from.id.toString()});

    if (!user) {
        return ctx.reply(`Доступ запрещен!`);
    }

    console.log(user.firstname)
    console.log(user.lastname)
    console.log(ctx.session?.systemMessages);
    if(!user.firstname || !user.lastname) {
        if (ctx.session?.systemMessages?.pop()?.type === 'updateUser') {
            ctx.session.systemMessages.push({type: 'updateUser', data: ctx.message?.text});
            return next();
        }
        return ctx.reply('Для взаимодействия с ботом Вам необходимо ввести имя и фамилию! Команда /start');
    }

    return next();
}