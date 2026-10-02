import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import type {
  BoardDestination,
  BoardSummary,
  CreateBoardInput,
  CreateUserInput,
  MapDestination,
  ProfileStats,
  UpdateProfileInput,
  UserProfile,
  UserRepository,
} from "./user.types.js";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  description: string;
  location: string | null;
  interests: string[];
  profile_picture_url: string | null;
  profile_picture_key: string | null;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface BoardRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  visibility: "private" | "friends" | "public";
  is_completed: boolean;
  destinations: BoardDestination[];
  created_at: Date;
  updated_at: Date;
  last_visited_at?: Date;
}

const userColumns = `
  u.id, u.username, u.display_name, p.description, p.location, p.interests,
  p.profile_picture_url, p.profile_picture_key, p.settings, u.created_at,
  GREATEST(u.updated_at, p.updated_at) AS updated_at`;

const boardColumns = `
  b.id, b.owner_id, b.title, b.description, b.visibility, b.is_completed,
  COALESCE(
    jsonb_agg(jsonb_build_object(
      'id', d.id, 'country', d.country_name, 'countryCode', d.country_code,
      'city', d.city, 'latitude', d.latitude, 'longitude', d.longitude
    ) ORDER BY d.created_at, d.id) FILTER (WHERE d.id IS NOT NULL),
    '[]'::jsonb
  ) AS destinations,
  b.created_at, b.updated_at`;

function toProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    description: row.description,
    location: row.location,
    interests: row.interests,
    profilePicture: row.profile_picture_url
      ? { url: row.profile_picture_url, storageKey: row.profile_picture_key }
      : null,
    settings: row.settings,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toBoard(row: BoardRow): BoardSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    isCompleted: row.is_completed,
    destinations: row.destinations,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(row.last_visited_at ? { lastVisitedAt: row.last_visited_at.toISOString() } : {}),
  };
}

async function queryProfile(client: Pool | PoolClient, userId: string): Promise<UserProfile | null> {
  const result = await client.query<UserRow>(
    `SELECT ${userColumns}
     FROM users u JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  return result.rows[0] ? toProfile(result.rows[0]) : null;
}

export function createPostgresUserRepository(pool: Pool): UserRepository {
  async function findUserById(id: string): Promise<UserProfile | null> {
    return queryProfile(pool, id);
  }

  async function findUserByUsername(username: string): Promise<UserProfile | null> {
    const result = await pool.query<UserRow>(
      `SELECT ${userColumns}
       FROM users u JOIN user_profiles p ON p.user_id = u.id
       WHERE lower(u.username) = lower($1)`,
      [username],
    );
    return result.rows[0] ? toProfile(result.rows[0]) : null;
  }

  async function createUser(input: CreateUserInput): Promise<UserProfile> {
    const client = await pool.connect();
    const id = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO users (id, username, display_name) VALUES ($1, $2, $3)",
        [id, input.username, input.displayName],
      );
      await client.query("INSERT INTO user_profiles (user_id) VALUES ($1)", [id]);
      const profile = await queryProfile(client, id);
      await client.query("COMMIT");
      if (!profile) throw new Error("PostgreSQL did not return the created user");
      return profile;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function updateProfile(userId: string, changes: UpdateProfileInput): Promise<UserProfile | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (changes.displayName !== undefined) {
        await client.query("UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1", [userId, changes.displayName]);
      }
      await client.query(
        `UPDATE user_profiles SET
          description = COALESCE($2, description),
          location = CASE WHEN $3 THEN $4 ELSE location END,
          interests = COALESCE($5, interests),
          settings = settings || COALESCE($6::jsonb, '{}'::jsonb),
          updated_at = now()
         WHERE user_id = $1`,
        [
          userId,
          changes.description ?? null,
          changes.location !== undefined,
          changes.location ?? null,
          changes.interests ?? null,
          changes.settings ? JSON.stringify(changes.settings) : null,
        ],
      );
      const profile = await queryProfile(client, userId);
      await client.query("COMMIT");
      return profile;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function setProfilePicture(userId: string, url: string, storageKey: string | null): Promise<UserProfile | null> {
    await pool.query(
      "UPDATE user_profiles SET profile_picture_url = $2, profile_picture_key = $3, updated_at = now() WHERE user_id = $1",
      [userId, url, storageKey],
    );
    return queryProfile(pool, userId);
  }

  async function deleteProfilePicture(userId: string): Promise<UserProfile | null> {
    await pool.query(
      "UPDATE user_profiles SET profile_picture_url = NULL, profile_picture_key = NULL, updated_at = now() WHERE user_id = $1",
      [userId],
    );
    return queryProfile(pool, userId);
  }

  async function getStats(userId: string): Promise<ProfileStats | null> {
    if (!(await findUserById(userId))) return null;
    const result = await pool.query<{
      countries_visited: string; boards_created: string; friends: string; places_saved: string; boards_saved: string;
    }>(
      `SELECT
        (SELECT count(DISTINCT d.country_code) FROM boards b JOIN board_destinations d ON d.board_id = b.id WHERE b.owner_id = $1 AND b.is_completed) AS countries_visited,
        (SELECT count(*) FROM boards WHERE owner_id = $1) AS boards_created,
        (SELECT count(*) FROM friendships WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)) AS friends,
        (SELECT count(*) FROM saved_places WHERE user_id = $1) AS places_saved,
        (SELECT count(*) FROM saved_boards WHERE user_id = $1) AS boards_saved`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      countriesVisited: Number(row.countries_visited), boardsCreated: Number(row.boards_created),
      friends: Number(row.friends), placesSaved: Number(row.places_saved), boardsSaved: Number(row.boards_saved),
    };
  }

  async function findOwnBoards(userId: string, limit: number): Promise<BoardSummary[]> {
    const result = await pool.query<BoardRow>(
      `SELECT ${boardColumns}
       FROM boards b LEFT JOIN board_destinations d ON d.board_id = b.id
       WHERE b.owner_id = $1
       GROUP BY b.id ORDER BY b.updated_at DESC, b.id LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(toBoard);
  }

  async function findRecentBoards(userId: string, limit: number): Promise<BoardSummary[]> {
    const result = await pool.query<BoardRow>(
      `SELECT ${boardColumns}, v.last_visited_at
       FROM board_visits v
       JOIN boards b ON b.id = v.board_id
       LEFT JOIN board_destinations d ON d.board_id = b.id
       WHERE v.user_id = $1 AND (
         b.owner_id = $1 OR b.visibility = 'public' OR (
           b.visibility = 'friends' AND EXISTS (
             SELECT 1 FROM friendships f WHERE f.status = 'accepted'
             AND ((f.requester_id = $1 AND f.addressee_id = b.owner_id) OR (f.addressee_id = $1 AND f.requester_id = b.owner_id))
           )
         )
       )
       GROUP BY b.id, v.last_visited_at
       ORDER BY v.last_visited_at DESC LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(toBoard);
  }

  async function findBoardById(boardId: string): Promise<BoardSummary | null> {
    const result = await pool.query<BoardRow>(
      `SELECT ${boardColumns}
       FROM boards b LEFT JOIN board_destinations d ON d.board_id = b.id
       WHERE b.id = $1 GROUP BY b.id`,
      [boardId],
    );
    return result.rows[0] ? toBoard(result.rows[0]) : null;
  }

  async function areFriends(firstUserId: string, secondUserId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM friendships WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
      [firstUserId, secondUserId],
    );
    return result.rowCount === 1;
  }

  async function recordBoardVisit(userId: string, boardId: string): Promise<void> {
    await pool.query(
      `INSERT INTO board_visits (user_id, board_id) VALUES ($1, $2)
       ON CONFLICT (user_id, board_id) DO UPDATE
       SET last_visited_at = now(), visit_count = board_visits.visit_count + 1`,
      [userId, boardId],
    );
  }

  async function createBoard(userId: string, input: CreateBoardInput): Promise<BoardSummary> {
    const client = await pool.connect();
    const boardId = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO boards (id, owner_id, title, description, visibility, is_completed)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [boardId, userId, input.title, input.description, input.visibility, input.isCompleted],
      );
      for (const destination of input.destinations) {
        await client.query(
          `INSERT INTO board_destinations (id, board_id, country_name, country_code, city, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), boardId, destination.country, destination.countryCode, destination.city, destination.latitude, destination.longitude],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const board = await findBoardById(boardId);
    if (!board) throw new Error("PostgreSQL did not return the created Board");
    return board;
  }

  async function saveBoard(userId: string, boardId: string): Promise<void> {
    await pool.query(
      "INSERT INTO saved_boards (user_id, board_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, boardId],
    );
  }

  async function unsaveBoard(userId: string, boardId: string): Promise<boolean> {
    const result = await pool.query("DELETE FROM saved_boards WHERE user_id = $1 AND board_id = $2", [userId, boardId]);
    return result.rowCount === 1;
  }

  async function findMapDestinations(userId: string): Promise<MapDestination[]> {
    const result = await pool.query<{
      id: string; board_id: string; board_title: string; country: string; country_code: string;
      city: string | null; latitude: number | null; longitude: number | null; is_completed: boolean;
    }>(
      `SELECT d.id, b.id AS board_id, b.title AS board_title, d.country_name AS country,
        d.country_code, d.city, d.latitude, d.longitude, b.is_completed
       FROM boards b JOIN board_destinations d ON d.board_id = b.id
       WHERE b.owner_id = $1 ORDER BY b.updated_at DESC, d.created_at, d.id`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.id, boardId: row.board_id, boardTitle: row.board_title, country: row.country,
      countryCode: row.country_code, city: row.city, latitude: row.latitude,
      longitude: row.longitude, isCompleted: row.is_completed,
    }));
  }

  return { findUserById, findUserByUsername, createUser, updateProfile, setProfilePicture, deleteProfilePicture, getStats, findOwnBoards, findRecentBoards, findBoardById, areFriends, recordBoardVisit, createBoard, saveBoard, unsaveBoard, findMapDestinations };
}
