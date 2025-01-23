import UserService from "../services/user-service.js";

export default async function updateLastActivityMiddleware(ctx, next) {
    let updateResponse;
    if (ctx.update?.message?.text === '/start') {
        updateResponse = await UserService.updateUser({telegramUsername: ctx.from.username}, {
            lastActivity: Date.now()
        });
    } else {
        updateResponse = await UserService.updateUser({telegramId: ctx.from.id.toString()}, {
            lastActivity: Date.now()
        });
    }

    // console.log('LOG FROM LAST ACTIVITY');
    // console.log(updateResponse);

    return next();
}