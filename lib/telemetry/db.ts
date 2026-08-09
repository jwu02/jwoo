// lib/telemetry/db.ts
import { MongoClient, Db, Collection } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.ACTIVITY_DB_NAME || "activity-telemetry";
const COLLECTION_NAME = "telemetry";

if (!MONGO_URI) {
  throw new Error("Missing MONGO_URI environment variable");
}

declare global {
  // Allow caching the client across hot reloads in development.
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

function getClient(): MongoClient {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(MONGO_URI!);
  }
  return global._mongoClient;
}

export function getTelemetryCollection(): Collection {
  const client = getClient();
  const db: Db = client.db(DB_NAME);
  return db.collection(COLLECTION_NAME);
}
