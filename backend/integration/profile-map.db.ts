import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import { closeDatabase, getPool } from "../src/db.js";
import { createUsersRepository } from "../src/features/users/users.repository.js";
import { createUsersService } from "../src/features/users/users.service.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "profile map reads persisted destinations and restricts every collection to the viewer",
    {
        skip: databaseUrl ? undefined : "TEST_DATABASE_URL or DATABASE_URL is required"
    },
    async () => {
        const schema = `rb_profile_map_${randomBytes(6).toString("hex")}`;
        const admin = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
        await admin.connect();
        const originalUrl = process.env.DATABASE_URL;
        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            const url = new URL(databaseUrl!);
            url.searchParams.set("options", `-csearch_path=${schema}`);
            process.env.DATABASE_URL = url.toString();
            const pool = getPool();
            for (const name of [
                "001_initial.sql",
                "002_auth_session.sql",
                "003_board_creator.sql",
                "004_api_features.sql",
                "006_profile.sql",
                "008_board_destination.sql"
            ]) {
                await pool.query(await readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8"));
            }
            await pool.query(`INSERT INTO app_user (user_id, username, display_name) VALUES
            ('traveler','traveler','Traveler'), ('friend','friend','Friend'),
            ('pending','pending','Pending'), ('outsider','outsider','Outsider'), ('author','author','Author');
            INSERT INTO friendship (status,requester_user_id,recipient_user_id) VALUES
            ('accepted','friend','traveler'), ('accepted','traveler','author'), ('pending','traveler','pending');
            INSERT INTO location (name,city,country,latitude,longitude) VALUES
            ('Bali','Denpasar','IDN',-8.65,115.22),
            ('Ho Chi Minh City','Ho Chi Minh City','VNM',10.77,106.70),
            ('Tokyo','Tokyo','JPN',35.68,139.76),
            ('Stockholm','Stockholm','SWE',59.33,18.07);`);
            const locationIds = (
                await pool.query<{ location_id: number }>("SELECT location_id FROM location ORDER BY location_id")
            ).rows.map((row) => row.location_id);
            const addBoard = async (
                owner: string,
                title: string,
                visibility: string,
                status: string,
                completed: boolean,
                locationId: number
            ) => {
                const result = await pool.query<{ board_id: number }>(
                    `INSERT INTO board (owner_user_id,title,visibility,status,is_completed,primary_location_id,primary_location_kind)
                 VALUES ($1,$2,$3,$4,$5,$6,'city') RETURNING board_id`,
                    [owner, title, visibility, status, completed, locationId]
                );
                const boardId = result.rows[0]!.board_id;
                await pool.query("INSERT INTO board_day (board_id,day_number) VALUES ($1,1)", [boardId]);
                return boardId;
            };
            const published = await addBoard("traveler", "Bali journey", "public", "published", true, locationIds[0]!);
            const friends = await addBoard(
                "traveler",
                "Friends journey",
                "friends",
                "published",
                true,
                locationIds[1]!
            );
            const restricted = await addBoard(
                "traveler",
                "Private journey",
                "collaborators",
                "published",
                true,
                locationIds[2]!
            );
            const draft = await addBoard("traveler", "Draft journey", "public", "draft", true, locationIds[3]!);
            const planned = await addBoard("traveler", "Future journey", "public", "published", false, locationIds[3]!);
            await pool.query(
                `INSERT INTO activity (board_id,day_id,day_number,position,title,type,location_id,location_confirmed)
                 SELECT v.board_id,d.day_id,1,v.position,v.title,'other',v.location_id,v.confirmed
                 FROM (VALUES ($1::int,0,'Walk',$6::int,true), ($1::int,1,'Unconfirmed',$7::int,false),
                 ($2::int,0,'Food',NULL,false), ($3::int,0,'Secret',NULL,false),
                 ($4::int,0,'Draft',NULL,false), ($5::int,0,'Planned',NULL,false))
                 AS v(board_id,position,title,location_id,confirmed)
                 JOIN board_day d ON d.board_id=v.board_id AND d.day_number=1`,
                [published, friends, restricted, draft, planned, locationIds[1], locationIds[2]]
            );
            for (const boardId of [published, friends, restricted, draft, planned]) {
                const image = await pool.query<{ uploaded_image_id: number }>(
                    "INSERT INTO uploaded_image (storage_key,uploaded_by_user_id,uploaded_at) VALUES ($1,'traveler',NOW()) RETURNING uploaded_image_id",
                    [`profile-map/${boardId}`]
                );
                await pool.query("INSERT INTO board_image (board_id,uploaded_image_id,position) VALUES ($1,$2,0)", [
                    boardId,
                    image.rows[0]!.uploaded_image_id
                ]);
            }
            const repository = createUsersRepository();
            await pool.query(
                `INSERT INTO saved_boards (user_id,board_id) VALUES
                 ('friend',$1), ('outsider',$1), ('friend',$2), ('friend',$3), ('friend',$4), ('traveler',$1)`,
                [published, friends, restricted, draft]
            );
            assert.equal((await repository.stats("traveler")).savesReceived, 4);
            assert.equal((await repository.stats("traveler", null)).savesReceived, 2);
            assert.equal((await repository.stats("traveler", "outsider")).savesReceived, 2);
            assert.equal((await repository.stats("traveler", "pending")).savesReceived, 2);
            assert.equal((await repository.stats("traveler", "friend")).savesReceived, 3);
            await pool.query("DELETE FROM saved_boards WHERE board_id=ANY($1::int[])", [
                [published, friends, restricted, draft]
            ]);
            const service = createUsersService(
                repository,
                {} as Parameters<typeof createUsersService>[1],
                {} as Parameters<typeof createUsersService>[2]
            );
            for (const viewer of [null, "outsider", "pending"]) {
                const profile = await service.publicProfile("traveler", viewer);
                assert.deepEqual(new Set(profile.boards.map((board) => board.boardId)), new Set([published, planned]));
                assert.deepEqual(
                    new Set(profile.destinations.map((place) => place.countryCode)),
                    new Set(["IDN", "VNM", "SWE"])
                );
                assert.equal(profile.stats.activitiesDone, 3, "all visible published Board activities count");
                assert.equal(profile.stats.countriesVisited, 3);
                assert.equal(
                    profile.stats.photosUploaded,
                    2,
                    "only visible published photos count, including an uncompleted Board"
                );
            }
            const friendProfile = await service.publicProfile("traveler", "friend");
            assert.deepEqual(
                new Set(friendProfile.boards.map((board) => board.boardId)),
                new Set([published, friends, planned])
            );
            assert.equal(friendProfile.stats.activitiesDone, 4);
            assert.equal(friendProfile.stats.photosUploaded, 3);
            const ownMap = await service.mapDestinations("traveler");
            assert.deepEqual(new Set(ownMap.map((place) => place.boardId)), new Set([published, friends, planned]));
            assert.ok(ownMap.every((place) => place.collection === "published" && place.boardTitle));
            assert.deepEqual(
                new Set((await service.mapDestinations("traveler", true)).map((place) => place.boardId)),
                new Set([published, friends])
            );
            const saved = await addBoard("author", "Saved city", "friends", "published", false, locationIds[2]!);
            const publicSaved = await addBoard(
                "author",
                "Public saved city",
                "public",
                "published",
                false,
                locationIds[1]!
            );
            const secretSaved = await addBoard(
                "friend",
                "Restricted saved",
                "collaborators",
                "published",
                true,
                locationIds[3]!
            );
            await pool.query(
                "INSERT INTO saved_boards (user_id,board_id) VALUES ('traveler',$1),('traveler',$2),('traveler',$3),('traveler',$4)",
                [saved, secretSaved, published, publicSaved]
            );
            await pool.query("INSERT INTO board_member (board_id,user_id,role) VALUES ($1,'traveler','viewer')", [
                secretSaved
            ]);
            const savedMap = await service.mapDestinations("traveler", false, true);
            assert.deepEqual(new Set(savedMap.map((place) => place.boardId)), new Set([saved, publicSaved]));
            assert.ok(savedMap.every((place) => place.collection === "saved"));
            assert.equal(savedMap.find((place) => place.boardId === saved)?.countryCode, "JPN");
            assert.deepEqual(
                new Set((await service.savedMapDestinations("traveler", "traveler")).map((place) => place.boardId)),
                new Set([saved, publicSaved])
            );
            assert.deepEqual(
                (await service.savedMapDestinations("traveler", "friend")).map((place) => place.boardId),
                [publicSaved],
                "profile friendship grants no access to another author's friends Board"
            );
            for (const viewer of ["outsider", "pending"]) {
                await assert.rejects(() => service.savedMapDestinations("traveler", viewer), { code: "FORBIDDEN" });
            }
            await assert.rejects(() => service.savedMapDestinations("unknown", "friend"), { code: "NOT_FOUND" });
            assert.deepEqual(await service.mapDestinations("outsider", false, true), []);
            await pool.query("DELETE FROM friendship WHERE status='accepted'");
            assert.deepEqual(
                (await service.mapDestinations("traveler", false, true)).map((place) => place.boardId),
                [publicSaved],
                "saving never grants access after friendship is removed"
            );
            await assert.rejects(() => service.savedMapDestinations("traveler", "friend"), { code: "FORBIDDEN" });
            assert.deepEqual(
                new Set((await service.publicProfile("traveler", "friend")).boards.map((board) => board.boardId)),
                new Set([published, planned])
            );
        } finally {
            await closeDatabase();
            if (originalUrl === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = originalUrl;
            await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.end();
        }
    }
);
