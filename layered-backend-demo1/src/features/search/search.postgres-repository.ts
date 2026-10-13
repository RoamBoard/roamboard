import type { Pool } from "pg";

import type { SearchDocument, SearchSourceRepository } from "./search.types.js";

export function createPostgresSearchSourceRepository(pool: Pool): SearchSourceRepository {
  async function findAll(): Promise<SearchDocument[]> {
    const result = await pool.query<{ document: SearchDocument }>(
      "SELECT document FROM search_documents ORDER BY id",
    );
    return result.rows.map((row) => row.document);
  }

  return { findAll };
}

export async function seedSearchDocuments(pool: Pool, documents: SearchDocument[]): Promise<void> {
  for (const document of documents) {
    await pool.query(
      "INSERT INTO search_documents (id, document) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
      [document.id, JSON.stringify(document)],
    );
  }
}
