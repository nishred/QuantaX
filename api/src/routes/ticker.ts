import {Router} from "express"
import { TickerData } from "../types/db";
import { createPool } from "../utils";
export const tickerRouter = Router();



// we fetch this data from the db.
// then we updates the LTP from the trades stream in the frontend.
tickerRouter.get('/',async (req,res) => {
    const query = `WITH ticker_trades AS (
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
                        ROUND(CAST(quoteVolume as NUMERIC),6) as quoteVolume,
                        symbol,
                        trades,
                        ROUND(CAST(volume as NUMERIC),6) as volume
                    FROM ticker_trades
                `
    try {
        const pgClient = createPool();
        const {rows} : {rows : TickerData[]} = await pgClient.query(query);
        const mappedTicker = rows.map(t => {
            return {
                "firstPrice": t.firstprice.toString(),
                "high": t.high.toString(),
                "lastPrice": t.lastprice.toString(),
                "low": t.low.toString(),
                "priceChange": t.pricechange.toString(),
                "priceChangePercent": t.pricechangepercent.toString(),
                "quoteVolume": t.quotevolume.toString(),
                "symbol": t.symbol.toString(),
                "trades": t.trades.toString(),
                "volume": t.volume.toString()
            }
        })
        res.json(mappedTicker)
    } catch (error) {
        console.log("error!")
    }
})
