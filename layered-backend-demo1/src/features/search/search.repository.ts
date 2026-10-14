import type {
  SearchDocument,
  SearchSourceRepository,
} from "./search.types.js";

function copyDocument(document: SearchDocument): SearchDocument {
  return {
    ...document,
    tags: [...document.tags],
    categories: [...document.categories],
    location: { ...document.location },
  };
}

export function createSearchSourceRepository(
  seed: SearchDocument[],
): SearchSourceRepository {
  const records = new Map<string, SearchDocument>(
    seed.map((document) => [document.id, copyDocument(document)]),
  );

  async function findAll(): Promise<SearchDocument[]> {
    return Array.from(records.values(), copyDocument);
  }

  return { findAll };
}