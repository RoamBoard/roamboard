import "dotenv/config";
import { closeDatabase, getPool } from "../db.js";

async function cleanup() {
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        await client.query("DELETE FROM board_view_challenge WHERE started_at<NOW()-INTERVAL '2 minutes'");
        await client.query("DELETE FROM board_view WHERE viewed_at<NOW()-INTERVAL '31 days'");
        await client.query("DELETE FROM board_browser WHERE expires_at<NOW()");
        await client.query("DELETE FROM board_save_event WHERE saved_at<NOW()-INTERVAL '60 days'");
        await client.query("COMMIT");
        process.stdout.write("Expired discovery tracking removed. Active saves and Board content are unchanged.\n");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
cleanup()
    .catch(() => {
        process.stderr.write("Discovery cleanup failed.\n");
        process.exitCode = 1;
    })
    .finally(closeDatabase);
