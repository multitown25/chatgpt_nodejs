import redisClient from "../services/redis-service.js";

export const rateLimiter = (limit, windowSec) => {
    return async (ctx, next) => {
        const userId = ctx.from.id;
        const key = `rateLimiter:${userId}`;
        try {
            const [requestCount, ttl] = await redisClient.multi()
                .incr(key)
                .ttl(key)
                .exec();

            if (ttl === -1) {
                await redisClient.expire(key, windowSec);
            }

            if (requestCount > limit) {
                await ctx.reply('Слишком много запросов! Пожалуйста, попробуйте позже.');
            } else {
                await next();
            }
        } catch (err) {
            console.error('Redis exec error:', err);
            // В случае ошибки пропускаем обработку
            await next();
        }
    };
};