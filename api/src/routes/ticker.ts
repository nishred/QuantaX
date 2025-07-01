import { Router } from "express";
import { TickerData } from "../types/db";
import { createPool } from "../utils";
import { RedisManager } from "../RedisManager";
export const tickerRouter = Router();

// we fetch this data from the db.
// then we updates the LTP from the trades stream in the frontend.

tickerRouter.get("/", async (req, res) => {
  try {
    const { market } = req.body;

    const response = await RedisManager.getInstance().sendAndAwait({
      type: "GET_TICKER",
      data: {
        market: market,
      },
    });

    res.json({
      success: true,
      data: response.payload,
    });
  } catch (err) {
    res.json({
      success: false,
      error: "Error fetching ticker data",
    });
  }
});
