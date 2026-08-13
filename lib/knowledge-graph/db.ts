import { getMongoClient } from "@/lib/telemetry/db";
import type { NoteDoc } from "./types";

export async function getNotesCollection() {
  const client = await getMongoClient();
  return client.db(process.env.ACTIVITY_DB_NAME).collection<NoteDoc>("notes");
}
