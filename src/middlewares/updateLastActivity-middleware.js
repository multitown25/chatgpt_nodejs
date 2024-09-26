import UserService from "../services/user-service.js";

export default async function updateLastActivityMiddleware(ctx, next) {
    const updateResponse = await UserService.updateUserByTgId(ctx.from.id.toString(), {
        lastActivity: Date.now()
    });
    console.log(updateResponse);

    return next();
}