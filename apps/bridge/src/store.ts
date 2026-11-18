import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Trip } from '@trucksim/core';

/** Local career log in SQLite (built into Node, no native module to build). */
export class TripStore {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        game TEXT,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS trips_ended ON trips (ended_at DESC);
    `);
  }

  save(trip: Trip): void {
    this.db
      .prepare(
        `INSERT INTO trips (id, game, status, source, started_at, ended_at, data)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, ended_at = excluded.ended_at, data = excluded.data`,
      )
      .run(trip.id, trip.gameId, trip.status, trip.source, trip.startedAt, trip.endedAt, JSON.stringify(trip));
  }

  /** Newest first. Paths are left out of lists to keep responses small. */
  list(limit = 50, opts: { includeDemo?: boolean } = {}): Trip[] {
    const rows = this.db
      .prepare(
        `SELECT data FROM trips ${opts.includeDemo ? '' : "WHERE source != 'demo'"} ORDER BY COALESCE(ended_at, started_at) DESC LIMIT ?`,
      )
      .all(limit) as Array<{ data: string }>;
    return rows.map((r) => {
      const t = JSON.parse(r.data) as Trip;
      return { ...t, path: [] };
    });
  }

  get(id: string): Trip | null {
    const row = this.db.prepare('SELECT data FROM trips WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Trip) : null;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM trips WHERE id = ?').run(id).changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
