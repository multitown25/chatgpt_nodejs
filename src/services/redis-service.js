import redis from "redis";

const redisURL = `redis://103.106.3.47:6379`;
const redisClient = redis.createClient({
    url: redisURL
});

await redisClient.connect();

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

export default redisClient;

