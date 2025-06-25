import { Pool } from "pg";

export function createPool() {
  const pool = new Pool({
    user: "your_user",
    host: "localhost",
    database: "my_database",
    password: "your_password",
    port: 5432,
    max: 100, // Set max connections
    idleTimeoutMillis: 10000,
  });
  return pool;
}
