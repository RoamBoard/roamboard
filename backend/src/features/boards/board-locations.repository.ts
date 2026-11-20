import type { PoolClient } from "pg";

export async function collectBoardLocationIds(client: PoolClient, boardId: number): Promise<number[]> {
    const result = await client.query<{ location_id: number }>(
        `SELECT b.primary_location_id AS location_id FROM board b
         WHERE b.board_id=$1 AND b.primary_location_id IS NOT NULL
         UNION
         SELECT a.location_id FROM activity a
         WHERE a.board_id=$1 AND a.location_id IS NOT NULL`,
        [boardId]
    );
    return result.rows.map((row) => row.location_id);
}

export async function collectOwnedBoardLocationIds(client: PoolClient, userId: string): Promise<number[]> {
    const result = await client.query<{ location_id: number }>(
        `SELECT b.primary_location_id AS location_id FROM board b
         WHERE b.owner_user_id=$1 AND b.primary_location_id IS NOT NULL
         UNION
         SELECT a.location_id FROM activity a JOIN board b ON b.board_id=a.board_id
         WHERE b.owner_user_id=$1 AND a.location_id IS NOT NULL`,
        [userId]
    );
    return result.rows.map((row) => row.location_id);
}

export async function removeUnreferencedLocations(client: PoolClient, locationIds: readonly number[]): Promise<void> {
    if (!locationIds.length) return;
    await client.query(
        `DELETE FROM location l WHERE l.location_id=ANY($1::int[])
         AND NOT EXISTS (SELECT 1 FROM board b WHERE b.primary_location_id=l.location_id)
         AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.location_id=l.location_id)`,
        [locationIds]
    );
}
