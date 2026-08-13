// lib/telemetry/db.ts
import { MongoClient, Db, Collection } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.ACTIVITY_DB_NAME || "activity-telemetry";
const TELEMETRY_COLLECTION_NAME = "telemetry";
const KEYBOARD_HEATMAP_COLLECTION_NAME = "keyboard_heatmap";

declare global {
  // Allow caching the client across hot reloads in development.
  var _mongoClient: MongoClient | undefined;
}

function getClient(): MongoClient {
  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI environment variable");
  }
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(MONGO_URI);
  }
  return global._mongoClient;
}

export function getMongoClient(): MongoClient {
  return getClient();
}

export function getTelemetryCollection(): Collection {
  const client = getClient();
  const db: Db = client.db(DB_NAME);
  return db.collection(TELEMETRY_COLLECTION_NAME);
}

export function getKeyboardHeatmapCollection(): Collection {
  const client = getClient();
  const db: Db = client.db(DB_NAME);
  return db.collection(KEYBOARD_HEATMAP_COLLECTION_NAME);
}
