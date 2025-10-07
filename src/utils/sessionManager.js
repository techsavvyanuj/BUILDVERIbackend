const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class SessionManager {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            keyPrefix: 'session:'
        });
    }

    // Create new session
    async createSession(userId, deviceInfo) {
        const sessionId = uuidv4();
        const session = {
            userId,
            deviceInfo,
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        await this.redis.set(
            sessionId,
            JSON.stringify(session),
            'EX',
            24 * 60 * 60 // 24 hours
        );

        return sessionId;
    }

    // Get session
    async getSession(sessionId) {
        const session = await this.redis.get(sessionId);
        return session ? JSON.parse(session) : null;
    }

    // Update session activity
    async updateActivity(sessionId) {
        const session = await this.getSession(sessionId);
        if (session) {
            session.lastActivity = Date.now();
            await this.redis.set(
                sessionId,
                JSON.stringify(session),
                'EX',
                24 * 60 * 60
            );
        }
    }

    // Invalidate session
    async invalidateSession(sessionId) {
        await this.redis.del(sessionId);
    }

    // Invalidate all sessions for user
    async invalidateUserSessions(userId) {
        const keys = await this.redis.keys(`session:*`);
        for (const key of keys) {
            const session = await this.getSession(key.replace('session:', ''));
            if (session && session.userId === userId) {
                await this.invalidateSession(key.replace('session:', ''));
            }
        }
    }

    // Get all active sessions for user
    async getUserSessions(userId) {
        const keys = await this.redis.keys(`session:*`);
        const sessions = [];
        for (const key of keys) {
            const session = await this.getSession(key.replace('session:', ''));
            if (session && session.userId === userId) {
                sessions.push({
                    sessionId: key.replace('session:', ''),
                    ...session
                });
            }
        }
        return sessions;
    }
}

module.exports = new SessionManager();
