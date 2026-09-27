import { MongoClient, Collection, Document } from "mongodb";

const DB_NAME = process.env.ACTIVITY_DB_NAME || "activity-telemetry";

declare global {
  // Allow caching the client across hot reloads in development.
  var _mongoClient: MongoClient | undefined;
}

/**
 * The one way into MongoDB: a collection by name. The URI is read per call so a
 * missing one throws at request time rather than at import time, and the client
 * is cached on the global so a hot reload reuses it.
 */
export function getCollection<T extends Document = Document>(
  name: string
): Collection<T> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Missing MONGO_URI environment variable");
  }
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(uri);
  }
  return global._mongoClient.db(DB_NAME).collection<T>(name);
}
