import Redis from 'redis';
import { createNodeRedisClient } from 'bullmq';

const redisClient = Redis.createClient({
    url: 'redis://localhost:6379',
});
const connection = createNodeRedisClient(redisClient);

export default connection;