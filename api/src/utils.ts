import { Pool } from "pg";

export function createPool() {
  const pool = new Pool({
    user: "your_user",
    host: "localhost",
    database: "my_database",
    password: "your_password",
    port: 5432,
    max: 100,
    idleTimeoutMillis: 10000, // Set max connections
  });
  return pool;
}
