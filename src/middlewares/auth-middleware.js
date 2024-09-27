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

    return next();
}