import { Router } from "express";
import { createPool } from "../utils";
export const dbRouter = Router();

dbRouter.post("/initialise", async (req, res) => {
  const asset_query = `
        CREATE TABLE IF NOT EXISTS crypto_assets (
            symbol        TEXT    NOT NULL PRIMARY KEY,
            name          TEXT    NOT NULL,
            created_at    TIMESTAMPTZ
        );
    `;
  const user_query = `CREATE TABLE IF NOT EXISTS crypto_users (
        user_id        SERIAL PRIMARY KEY,
        first_name     TEXT,
        last_name      TEXT,
        email          TEXT NOT NULL UNIQUE,
        password       TEXT NOT NULL,
        country        TEXT,
        state          TEXT,
        city           TEXT,
        phone          CHAR(10),
        pincode        CHAR(6),
        verified       BOOLEAN   DEFAULT false
    )`;

  // const otp_table_query = `
  //       CREATE TABLE IF NOT EXISTS otp_table (
  //           id          SERIAL PRIMARY KEY,
  //           user_id     INT  NOT NULL,
  //           token       UUID,
  //           otp         CHAR(6),
  //           expiry      TIMESTAMPTZ,
  //           verified    BOOLEAN DEFAULT false,
  //           FOREIGN KEY (user_id) REFERENCES crypto_users(user_id)
  //       );
  //   `;

  const order_query = `

        CREATE TABLE  IF NOT EXISTS crypto_orders (
            order_id         TEXT   PRIMARY KEY,
            symbol           TEXT  NOT NULL,
            user_id          INT   NOT NULL,
            price            DOUBLE PRECISION NOT NULL,
            qty             DOUBLE PRECISION NOT NULL,
            filled          DOUBLE PRECISION NOT NULL,
            status          TEXT,
            time            TIMESTAMPTZ,
            side            TEXT,
            FOREIGN KEY (user_id) REFERENCES crypto_users(user_id),
            FOREIGN KEY (symbol) REFERENCES crypto_assets(symbol)
        )
    `;

  const trade_query = `
       -- 1) Create the base table (if it doesn’t already exist)
CREATE TABLE IF NOT EXISTS crypto_trades (
    trade_id           INT               NOT NULL,
    symbol             TEXT              NOT NULL,
    time               TIMESTAMPTZ       NOT NULL,
    price              DOUBLE PRECISION  NOT NULL,
    qty                DOUBLE PRECISION  NOT NULL,
    quote_qty          DOUBLE PRECISION  NOT NULL,
    is_buyer_maker     BOOLEAN,
    seller_id          INT               NOT NULL,
    buyer_id           INT               NOT NULL,
    PRIMARY KEY (trade_id, symbol, time),
    FOREIGN KEY (seller_id) REFERENCES crypto_users(user_id),
    FOREIGN KEY (buyer_id) REFERENCES crypto_users(user_id)
);

-- 2) Convert it into a hypertable with sensible defaults
SELECT create_hypertable(
    'crypto_trades',              -- table name
    'time',                       -- time column
    if_not_exists      => TRUE,   -- no error if already a hypertable
    chunk_time_interval => INTERVAL '1 day'
);

    `;

  try {
    const pgClient = createPool();
    await pgClient.query("BEGIN");
    await pgClient.query(asset_query);
    await pgClient.query(user_query);
    // await pgClient.query(otp_table_query);
    await pgClient.query(order_query);
    await pgClient.query(trade_query);
    await pgClient.query("COMMIT");
    res.json({
      success: true,
      message: "Database initialised successfully !",
    });
  } catch (error) {
    console.log("db error", error);
    res.json({
      success: false,
      error: "Rolled back to initial state !",
    });
  }
});

dbRouter.post("/initialise/candle", async (req, res) => {
  const one_min = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS one_min_candle
        WITH (timescaledb.continuous) AS 
        SELECT 
            time_bucket('1 min',time) AS bucket,
            symbol,
            FIRST(price,time) AS open,
            LAST(price,time) AS close,
            MIN(price) AS low,
            MAX(price) AS high,
            SUM(qty) AS volume,
            SUM(quote_qty) AS quotevolume,
            COUNT(*) AS trades
        FROM crypto_trades
        GROUP BY bucket,symbol;
    `;

  const five_min = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS five_min_candle
        WITH (timescaledb.continuous) AS 
        SELECT 
            time_bucket('5 min',time) AS bucket,
            symbol,
            FIRST(price,time) AS open,
            LAST(price,time) AS close,
            MIN(price) AS low,
            MAX(price) AS high,
            SUM(qty) AS volume,
            SUM(quote_qty) AS quotevolume,
            COUNT(*) AS trades
        FROM crypto_trades
        GROUP BY bucket,symbol;
    `;
  const one_hour = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS one_hour_candle
        WITH (timescaledb.continuous) AS 
        SELECT 
            time_bucket('1 hour',time) AS bucket,
            symbol,
            FIRST(price,time) AS open,
            LAST(price,time) AS close,
            MIN(price) AS low,
            MAX(price) AS high,
            SUM(qty) AS volume,
            SUM(quote_qty) AS quotevolume,
            COUNT(*) AS trades
        FROM crypto_trades
        GROUP BY bucket,symbol;
    `;
  const one_day = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS one_day_candle
        WITH (timescaledb.continuous) AS 
        SELECT 
            time_bucket('1 day',time) AS bucket,
            symbol,
            FIRST(price,time) AS open,
            LAST(price,time) AS close,
            MIN(price) AS low,
            MAX(price) AS high,
            SUM(qty) AS volume,
            SUM(quote_qty) AS quotevolume,
            COUNT(*) AS trades
        FROM crypto_trades
        GROUP BY bucket,symbol;
    `;

  try {
    const pgClient = createPool();
    await pgClient.query(one_min);
    await pgClient.query(five_min);
    await pgClient.query(one_hour);
    await pgClient.query(one_day);
    res.json({
      success: true,
      message: "Candles initialised duccessfully !",
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: "Error occured !",
    });
  }
});

dbRouter.post("/initialise/refresh", async (req, res) => {
  const refresh1 = `
        SELECT add_continuous_aggregate_policy('one_min_candle',
        start_offset => INTERVAL '30 minutes',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '30 seconds');
    `;
  const refresh2 = `
        SELECT add_continuous_aggregate_policy('five_min_candle',
        start_offset => INTERVAL '6 hours',
        end_offset => INTERVAL '5 minutes',
        schedule_interval => INTERVAL '2 minutes');
    `;
  const refresh3 = `
        SELECT add_continuous_aggregate_policy('one_hour_candle',
        start_offset => INTERVAL '2 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '15 minutes');
    `;
  const refresh4 = `
        SELECT add_continuous_aggregate_policy('one_day_candle',
        start_offset => INTERVAL '14 days',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 hour');
    `;

  try {
    const pgClient = createPool();
    await pgClient.query(refresh1);
    await pgClient.query(refresh2);
    await pgClient.query(refresh3);
    await pgClient.query(refresh4);
    res.json({
      success: true,
      message: "refresh initialised duccessfully !",
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: "Error occured !",
    });
  }
});
