import {Router} from "express"
import { KlineData } from "../types/db";
import { createPool } from "../utils";

export const klinesRouter = Router();

//data from --> DB

klinesRouter.get('/',async (req,res) => {
    const symbol = req.query.symbol;
    const interval = req.query.interval;
    if(!symbol || !interval){
        res.json({
            success : false,
            message : "Invalid symbol and interval"
        })
    }
    let query;
    const values = [symbol];
    switch (interval) {
        case "1m":
            query = `SELECT * FROM one_min_candle WHERE symbol = $1 ORDER BY bucket DESC`
            break;
        case "5m":
            query = `SELECT * FROM five_min_candle WHERE symbol = $1 ORDER BY bucket DESC`
            break;
        case "1h":
            query = `SELECT * FROM one_hour_candle WHERE symbol = $1 ORDER BY bucket DESC`
            break;
        case "1d":
            query = `SELECT * FROM one_day_candle WHERE symbol = $1 ORDER BY bucket DESC`
            break;
        default:
            query = `SELECT * FROM one_day_candle WHERE symbol = $1 ORDER BY bucket DESC`
            break;
    }
    try {
        const pgClient = createPool();
        const {rows} : {rows : KlineData[]}= await pgClient.query(query ,values);
        const mappedKlines = rows.map(data => {
            let end_time : Date;
            switch (interval) {
                case "1m":
                    end_time = new Date(data.bucket.getTime() + 1000*60);
                    break;
                case "5m":
                    end_time = new Date(data.bucket.getTime() + 1000*60*5);
                break;
                case "1h":
                    end_time = new Date(data.bucket.getTime() + 1000*60*60);
                break;
                case "1d":
                    end_time = new Date(data.bucket.getTime() + 1000*60*60*24);
                break;
                default:
                    end_time = data.bucket;
                break;
            }
            return {
                "close": data.close.toString(),
                "end": end_time,
                "high": data.high.toString(),
                "low": data.low.toString(),
                "open": data.open.toString(),
                "quoteVolume": data.quotevolume.toString(),
                "start": data.bucket,
                "trades": data.trades.toString(),
                "volume": data.volume.toString()
            }
        })
        res.json(mappedKlines)
    } catch (error) {
        res.json({
            success : false,
            message : "Error occured !"
        })
    }
})
