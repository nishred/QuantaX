import { Router } from "express";
import { TradesData } from "../types/db";
import { createPool } from "../utils";

export const tradesRouter = Router();

//trades = fills array .... fills will go to the db.
//we will extract this from db.
tradesRouter.get("/", async (req, res) => {
  const symbol = req.query.symbol;
  const limit = req.query.limit;
  if (!symbol || !limit) {
    res.json({
      success: false,
      message: "Invalid symbol and limit",
    });
  } else {
    try {
      const pgClient = createPool();
      const query = `
                SELECT trade_id,time,price,qty,quote_qty,is_buyer_maker
                FROM crypto_trades
                WHERE symbol = $1
                ORDER BY trade_id DESC
                LIMIT $2
            `;
      const value = [symbol, limit];
      const { rows }: { rows: TradesData[] } = await pgClient.query(
        query,
        value
      );
      const mappedData = rows.map((t) => {
        return {
          id: t.trade_id,
          isBuyerMaker: t.is_buyer_maker,
          price: t.price.toString(),
          quantity: t.qty.toString(),
          quoteQuantity: t.quote_qty.toString(),
          timestamp: t.time.getTime(),
        };
      });
      res.json(mappedData);
    } catch (error) {
      console.log(error);
      res.json({
        success: false,
        message: "Error occured !",
      });
    }
  }
});
