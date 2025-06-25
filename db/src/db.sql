--1. Create only 2 tables.
--   --> 1. crypto_assets.
--   --> 2. crypto_trades.
--   NO need for crypto_prices independently (since we also need volume(sum(qty)) , quoteVolume(sum(quoteQty)), no of trades (sum(*)));
--2. Name of table , fields should always be in lowercase to avoid any confusion.
--3. type TIMESTAMPTZ = Time stamp with time zone.



-- symbol is primary key.
CREATE TABLE crypto_assets (
    symbol      TEXT   PRIMARY KEY,
    name        TEXT
)


-- trade_id can be duplicate (since we will have different symbols).
-- (trade_id,symbol) is the primary key.
-- Since there is a primary key defined in the table .... 
--       we need to add time (the field on basis of which we will make hypertable.) in composite primary key.
-- Final primary key (trade_id,symbol,time).
CREATE TABLE crypto_trades (
    trade_id         INT NOT NULL,
    symbol           TEXT  NOT NULL,
    time             TIMESTAMPTZ  NOT NULL,
    price            DOUBLE PRECISION NOT NULL,
    quantity         DOUBLE PRECISION NOT NULL,
    quote_quantity   DOUBLE PRECISION NOT NULL,
    is_buyer_maker   BOOLEAN,
    PRIMARY KEY (trade_id,symbol,time),
	FOREIGN KEY (symbol) REFERENCES crypto_assets(symbol)
)



--hypertable can only be created for empty table.
SELECT create_hypertable(
    'crypto_trades',
    by_range('time')
)


-- Other than aggregates, Jo column bache h vo group by me jayenge hi.
-- Order by yaha nhi hoga.
CREATE MATERIALIZED VIEW one_min_candle
WITH (timescaledb.continuous) AS 
SELECT 
    time_bucket('1 min',time) AS bucket,
    symbol,
    FIRST(price,time) AS open,
    LAST(price,time) AS close,
    MIN(price) AS low,
    MAX(price) AS high,
    SUM(quantity) AS volume,
    SUM(quote_quantity) AS quotevolume,
    COUNT(*) AS trades
FROM crypto_trades
GROUP BY bucket,symbol;


--adding refreshing policy.
-- start_offest -> Kitna pehle tk ka data ko refresh krna h.
-- end_offset -> Kitna recent tk ka data ko update krna h.
-- Schedule_interval -> kitna frequently update krna h.
-- here -> 30 min pehle se 1 min pehle tk ka data ko refresh krna h.
SELECT add_continuous_aggregate_policy('one_min_candle',
  start_offset => INTERVAL '30 min',
  end_offset => INTERVAL '1 min',
  schedule_interval => INTERVAL '30 second');






--query for ticker.
--no need for materialized view.
-- METHOD 1 -> use of distinct on (symbol).
-- Distinct on --> It will Only Select the first row for each unique value (as determined by the specified column(s)).
--             --> Always used With order by (Must be the first to be ordered).
--             --> Use it if you want to select first row for each distinct values of a specified column.
--             --> ex. I wanted the latest one_day_candle for every distinct symbol.

-- With as (sql query) select --> It helps to perform some further operations on a temporary result.
--                            --> ex. Here it helped to calculate (priceChange,changePercent) on the previous retrieved column  
 
WITH ticker_trades AS (
	SELECT DISTINCT ON (symbol) 
		time_bucket('1 day',time) as bucket,
		FIRST(price,time) AS firstPrice,
		MAX(price) AS high,
		LAST(price,time) AS lastPrice,
		MIN(price) AS low,
		SUM(quote_qty) AS quoteVolume,
		symbol,
		COUNT(*) AS trades,
		SUM(qty) AS volume
	FROM crypto_trades
	GROUP BY bucket,symbol
	ORDER BY symbol,bucket DESC
)
SELECT 
	firstPrice,
	high,
	lastPrice,
	low,
	ROUND(CAST((lastPrice-firstPrice) as NUMERIC),6) AS priceChange,
	ROUND(CAST(((lastPrice-firstPrice)/firstPrice)*100 AS NUMERIC),6) AS priceChangePercent,
	quoteVolume,
    symbol,
	trades,
	volume
FROM ticker_trades