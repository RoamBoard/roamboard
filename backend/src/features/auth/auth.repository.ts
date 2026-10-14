import { getPool } from "../../db.js";
import type { AppUser, AuthRepository } from "./auth.types.js";

interface UserRow {
    user_id: string;
    username: string;
    display_name: string;
}

function toUser(row: UserRow): AppUser {
    return {
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name
    };
}

export function createAuthRepository(): AuthRepository {
    return {
        async findUserById(userId) {
            const result = await getPool().query<UserRow>(
                "SELECT user_id, username, display_name FROM app_user WHERE user_id = $1",
                [userId]
            );
            return result.rows[0] ? toUser(result.rows[0]) : null;
        },
        async createUser(user) {
            const result = await getPool().query<UserRow>(
                `INSERT INTO app_user (user_id, username, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING user_id, username, display_name`,
                [user.userId, user.username, user.displayName]
            );
            return result.rows[0] ? toUser(result.rows[0]) : null;
        },
        async createSession(tokenHash, userId, expiresAt) {
            await getPool().query("INSERT INTO auth_session (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
                tokenHash,
                userId,
                expiresAt
            ]);
        },
        async findUserBySession(tokenHash) {
            const result = await getPool().query<UserRow>(
                `SELECT u.user_id, u.username, u.display_name
         FROM auth_session AS s
         JOIN app_user AS u ON u.user_id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
                [tokenHash]
            );
            return result.rows[0] ? toUser(result.rows[0]) : null;
        },
        async deleteSession(tokenHash) {
            await getPool().query("DELETE FROM auth_session WHERE token_hash = $1", [tokenHash]);
        }
    };
}
