import { Router } from "express";
import { RedisManager } from "../RedisManager";
import { createPool } from "../utils";
import axios from "axios";

export const botRouter = Router();

//data form --> Memory ( orderbook )
botRouter.post("/create", async (req, res) => {
  const { bot_id, baseQty, quoteQty, baseAsset, quoteAsset } = req.body;

  console.log("bot_id : " + bot_id);

  const query = `
        INSERT INTO crypto_users (user_id,email,password)
        VALUES ($1,$2,$3)
        ON CONFLICT (user_id) DO NOTHING;
    `;
  const values = [bot_id, Math.random().toString(), "password"];
  try {
    const pgClient = createPool();
    await pgClient.query(query, values);
    const response = await RedisManager.getInstance().sendAndAwait({
      type: "ADD_BOT",
      data: {
        bot_id: bot_id,
        baseQty: baseQty,
        quoteQty: quoteQty,
        baseAsset: baseAsset,
        quoteAsset: quoteAsset,
      },
    });
    res.json(response.payload);
    return;
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: "error occured !",
    });
    return;
  }
});

let botRunning_1 = false;
let botInterval_1: any = null;

botRouter.post("/start/bot-buy", async (req, res) => {
  const { maxOrders, market, basePrice, spread } = req.body;
  if (!maxOrders || !market || !basePrice || !spread) {
    res.json({
      message: "All fields are required !",
    });
    return;
  }
  if (botRunning_1) {
    res.json({
      message: "Bot already running !",
    });
    return;
  }

  botRunning_1 = true;
  let count = 0;

  botInterval_1 = setInterval(async () => {
    if (count >= maxOrders) {
      clearInterval(botInterval_1);
      botRunning_1 = false;
      console.log("Bot_1 finished placing all orders.");
      res.json("Bot_1 finished placing all orders.");
      return;
    }
    await placeBuyOrder({ market, basePrice, spread });
    count++;
  }, 400);
});

botRouter.post("/stop/bot-buy", async (req, res) => {
  if (botRunning_1) {
    clearInterval(botInterval_1);
    botRunning_1 = false;
    res.json({ message: "Bot stopped manually." });
    return;
  }
  res.json({ message: "Bot is not running." });
  return;
});

async function placeBuyOrder({
  market,
  basePrice,
  spread,
}: {
  market: string;
  basePrice: number;
  spread: number;
}) {
  const price = (basePrice + (Math.random() * spread * 2 - spread)).toFixed(1);
  const quantity = (Math.random() * 50 + 1).toFixed(2);
  try {
    await axios.post("http://localhost:3001/api/v1/order", {
      market: market,
      price: parseFloat(Number(price).toFixed(2)),
      quantity: parseFloat(Number(quantity).toFixed(2)),
      side: "buy",
      userId: "1",
    });
    console.log("Placed buy order : ");
    console.log("price : " + price);
    console.log("quantity : " + quantity);
  } catch (error) {
    console.log("Error in placing buy order !");
  }
}

let botRunning_2 = false;
let botInterval_2: any = null;

botRouter.post("/start/bot-sell", async (req, res) => {
  const { maxOrders, market, basePrice, spread } = req.body;
  if (!maxOrders || !market || !basePrice || !spread) {
    res.json({
      message: "All fields are required !",
    });
    return;
  }
  if (botRunning_2) {
    res.json({
      message: "Bot already running !",
    });
    return;
  }

  botRunning_2 = true;
  let count = 0;

  botInterval_2 = setInterval(async () => {
    if (count >= maxOrders) {
      clearInterval(botInterval_2);
      botRunning_2 = false;
      console.log("Bot_2 finished placing all orders.");
      res.json("Bot_2 finished placing all orders.");
      return;
    }
    await placeSellOrder({ market, basePrice, spread });
    count++;
  }, 300);
});

botRouter.post("/stop/bot-sell", async (req, res) => {
  if (botRunning_2) {
    clearInterval(botInterval_2);
    botRunning_2 = false;
    res.json({ message: "Bot_2 stopped manually." });
    return;
  }
  res.json({ message: "Bot_2 is not running." });
  return;
});

async function placeSellOrder({
  market,
  basePrice,
  spread,
}: {
  market: string;
  basePrice: number;
  spread: number;
}) {
  const price = (basePrice + (Math.random() * spread * 2 - spread)).toFixed(1);
  const quantity = (Math.random() * 40 + 1).toFixed(2);
  try {
    await axios.post("http://localhost:3001/api/v1/order", {
      market: market,
      price: parseFloat(Number(price).toFixed(2)),
      quantity: parseFloat(Number(quantity).toFixed(2)),
      side: "sell",
      userId: "2",
    });
    console.log("Placed sell order : ");
    console.log("price : " + price);
    console.log("quantity : " + quantity);
  } catch (error) {
    console.log("Error in placing sell order !");
  }
}
