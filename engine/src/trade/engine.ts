import { RedisManager } from "../RedisManager";
import { MessageFromApi } from "../types/fromApi";
import { Fill, Order, OrderBook } from "./orderbook";
import { v4 as uuid } from "uuid";
import fs from "fs";

//this is how it was being set.
// balances.set("1",{
//     ["sol"]:{available : 1,locked : 2},
//     ["usdc"]:{available : 1,locked : 2}
// })

export interface UserBalance {
  [key: string]: {
    available: number;
    locked: number;
  };
}

export class Engine {
  private orderbooks: OrderBook[] = [];
  private balances: Map<string, UserBalance> = new Map();

  constructor() {
    let snapshot = null;
    try {
      snapshot = fs.readFileSync("./snapshot.json");
    } catch (e) {
      console.log(e);
      console.log("No snapshot found");
    }

    if (snapshot) {
      const snapshotSnapshot = JSON.parse(snapshot.toString());
      this.orderbooks = snapshotSnapshot.orderbooks.map(
        (o: any) =>
          new OrderBook(
            o.baseAsset,
            o.quoteAsset,
            o.bids,
            o.asks,
            o.lastTradeId,
            o.currentPrice
          )
      );
      this.balances = new Map(snapshotSnapshot.balances);
      console.log(this.orderbooks);
      console.log(this.balances);
    }
    setInterval(() => {
      this.saveSnapshot();
    }, 1000 * 3);
  }

  public getState() {
    return {
      orderbooks: this.orderbooks.map((o) => o.getSnapshot()),
      balances: this.balances,
    };
  }

  saveSnapshot() {
    const snapshotSnapshot = {
      orderbooks: this.orderbooks.map((o) => o.getSnapshot()),
      balances: Array.from(this.balances.entries()),
    };
    fs.writeFileSync("./snapshot.json", JSON.stringify(snapshotSnapshot));
  }

  process({
    message,
    clientId,
  }: {
    message: MessageFromApi;
    clientId: string;
  }) {
    switch (message.type) {
      case "CREATE_ORDER":
        try {
          //Go to orderbook....create order...return (executedQty, fills, orderId)
          const { executedQty, fills, orderId } = this.createOrder(
            message.data.market,
            message.data.price,
            message.data.quantity,
            message.data.side,
            message.data.userId
          );

          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_PLACED",
            payload: {
              orderId,
              executedQty,
              fills,
            },
          });
        } catch (e: any) {
          console.log(e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_FAILED",
            payload: {
              message: e.message || ("Unknown error occured !" as string),
            },
          });
        }
        break;

      case "GET_OPEN_ORDERS":
        try {
          console.log("market from api", message.data.market);

          const orderbook = this.orderbooks.find(
            (orderbook) => orderbook.ticker() == message.data.market
          );
          if (!orderbook) {
            throw new Error("No orderbook found!");
          }
          const getOpenOrders = orderbook.getOpenOrders(message.data.userId);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "OPEN_ORDERS",
            payload: {
              asks: getOpenOrders.asks,
              bids: getOpenOrders.bids,
            },
          });
        } catch (error) {
          console.log(error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "OPEN_ORDERS",
            payload: {
              asks: [],
              bids: [],
            },
          });
        }
        break;
      case "GET_DEPTH":
        try {
          const orderbook = this.orderbooks.find(
            (orderbook) => orderbook.ticker() == message.data.market
          );
          if (!orderbook) {
            throw new Error("No orderbook found!");
          }
          const depth = orderbook.getDepths();
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: {
              asks: depth.asks,
              bids: depth.bids,
            },
          });
        } catch (error) {
          console.log(error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: {
              asks: [],
              bids: [],
            },
          });
        }
        break;
      case "CANCEL_ORDER":
        try {
          const { cancelled_order } = this.cancelOrder(
            message.data.market,
            message.data.orderId
          );
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: cancelled_order.orderId,
              executedQty: cancelled_order.filled,
              remainingQty: cancelled_order.quantity - cancelled_order.filled,
            },
          });
        } catch (e: any) {
          console.log(e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "CANCEL_ORDER_FAILED",
            payload: {
              executedQty: 0,
              remainingQty: 0,
              message: e.message || ("Unknown errror occurred!" as string),
            },
          });
        }
        break;

      case "GET_BALANCE":
        try {
          const { user_balance } = this.getUserBalance(message.data.userId);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "BALANCE",
            payload: {
              balances: user_balance,
            },
          });
        } catch (e) {
          console.log(e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "BALANCE",
            payload: {
              balances: {},
            },
          });
        }

        break;

      case "ADD_USER":
        this.createUser(message.data.user_id);
        RedisManager.getInstance().sendToApi(clientId, {
          type: "USER_CREATED",
          payload: {
            success: true,
            message: "User created successfully !",
          },
        });
        break;
      case "ADD_MARKET":
        const { baseAsset, quoteAsset } = message.data;
        try {
          this.createOrderbook(baseAsset, quoteAsset);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "MARKET_ADDED",
            payload: {
              success: true,
              message: `${baseAsset}_${quoteAsset} Market added successfully !`,
            },
          });
        } catch (error) {
          console.log(error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "MARKET_ADDED",
            payload: {
              success: false,
              message: `Market exist already!`,
            },
          });
        }
        break;

      case "GET_TICKER":
        try {
          const orderbook = this.orderbooks.find((orderbook) => {
            return orderbook.ticker() == message.data.market;
          });

          if (!orderbook) {
            throw new Error("No orderbook found!");
          }

          const currentPrice = orderbook.currentPrice;

          const { bid, ask } = orderbook.getBestBidsAsks();

          const fairPrice = (bid + ask) / 2;

          RedisManager.getInstance().sendToApi(clientId, {
            type: "TICKER",
            payload: {
              currentPrice: parseFloat(currentPrice.toFixed(2)),
              fairPrice: parseFloat(fairPrice.toFixed(2)),
            },
          });
        } catch (error) {
          console.log(error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "TICKER",
            payload: {
              currentPrice: 0,
              fairPrice: 0,
            },
          });
        }

        break;

      case "ADD_BOT":
        try {
          this.createBot(message.data);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "BOT_ADDED",
            payload: {
              success: true,
              message: "Bot added successfully!",
            },
          });
        } catch (error) {
          RedisManager.getInstance().sendToApi(clientId, {
            type: "BOT_ADDED",
            payload: {
              success: false,
              message: "Error while adding bot!",
            },
          });
        }
      default:
        break;
    }
  }

  createBot({
    bot_id,
    baseQty,
    quoteQty,
    baseAsset,
    quoteAsset,
  }: {
    bot_id: string;
    baseQty: number;
    quoteQty: number;
    baseAsset: string;
    quoteAsset: string;
  }) {
    this.balances.set(bot_id, {
      [baseAsset]: {
        available: baseQty,
        locked: 0,
      },

      [quoteAsset]: {
        available: quoteQty,
        locked: 0,
      },
    });
  }

  createOrderbook(baseAsset: string, quoteAsset: string) {
    const orderbook = this.orderbooks.find((orderbook) => {
      if (orderbook.ticker() == baseAsset + "_" + quoteAsset) {
        return orderbook;
      } else {
        return null;
      }
    });
    if (!orderbook) {
      this.orderbooks.push(new OrderBook(baseAsset, quoteAsset, [], [], 0, 0));
      console.log(this.orderbooks);
    } else {
      throw new Error("OrderBook exist !");
    }
  }
  createUser(userId: string) {
    this.balances.set(userId, {
      ["SOL"]: {
        available: 0,
        locked: 0,
      },
      ["USDC"]: {
        available: 20000,
        locked: 0,
      },
    });
    console.log({
      userId: userId,
      message: "User added successfully !",
    });
  }

  getUserBalance(userId: string): { user_balance: UserBalance } {
    const user_balance = this.balances.get(userId);
    if (!user_balance) {
      throw new Error("No balances found");
    }
    return { user_balance };
  }

  createOrder(
    market: string,
    price: number,
    quantity: number,
    side: "buy" | "sell",
    userId: string
  ) {
    const orderbook = this.orderbooks.find((orderbook) => {
      if (orderbook.ticker() == market) {
        return orderbook;
      } else {
        return null;
      }
    });
    if (!orderbook) {
      throw new Error("No orderbook found");
    }
    const baseAsset = orderbook.baseAsset;
    const quoteAsset = orderbook.quoteAsset;

    //Lock the funds before any trade happens.

    //locking needs to happen, even though the user cant place any additional order till this is resolved (remember, in the order's api we are waiting till me get a subscrption on the clientId from the pubsub. But the user can login from another client browser and place the order right. Thats why we have to lock the funds till the order is resolved).

    //lock funds need to check if the user has enough funds to place the order.

    this.LockFunds(baseAsset, quoteAsset, quantity, price, side, userId);

    //now create an initial order .. then go on to add that order in orderbook
    const order: Order = {
      orderId: uuid(),
      userId,
      price,
      quantity,
      side,
      filled: 0,
      time: new Date(),
      status: "new",
    };

    console.log("order in engine", order);

    // ==========BUY SIDE==========

    //1) iterate over the asks in the ascending order and keep on assigning the fills to the order

    //2) for every fill, a) update the order's filled quantity b) update the order book c) release the funds from both the users balances d) create a trade

    //note: if there is no active subscriber on a channel to the redis pubsub, the message will be gone, the pubsub wont wait for the subscriber to come online. So, we have to make sure that the user is subscribed to the channel before we publish the message.

    //so if we pubslish a message on a channel that doesnt have any active subscriber the message gone. Where as kafka will wait for the subscriber to come online and then publish the message.(and even after publishing the message, it will store the message in the topic till the retention time is over).
    //and you can replay the messages in kafka, but not in redis pubsub.

    const { fills, executedQty } = orderbook.addOrder(order);

    console.log("fills in engine", fills);

    this.updateBalance(userId, baseAsset, quoteAsset, side, fills);
    this.createDbOrders(order, market);
    this.updateDbOrders(fills);
    this.createDbTrades(fills, market, userId, side, order.orderId);
    this.publishWsDepthUpdates(fills, price, side, market, orderbook);
    this.publishWsTrades(fills, userId, market);
    orderbook.cleanUp();
    this.publishWsBookTickerUpdates(fills, orderbook, market);
    return { executedQty, fills, orderId: order.orderId };
  }

  publishWsBookTickerUpdates(
    fills: Fill[],
    orderbook: OrderBook,
    market: string
  ) {
    const { bid, ask } = orderbook.getBestBidsAsks();

    const fairPrice = (bid + ask) / 2;

    RedisManager.getInstance().publishToWs(`bookTicker.${market}`, {
      stream: `bookTicker.${market}`,
      data: {
        e: "bookTicker",
        currentPrice: parseFloat(orderbook.currentPrice.toFixed(2)),
        fairPrice: parseFloat(fairPrice.toFixed(2)),
      },
    });
  }

  createDbOrders(order: Order, market: string) {
    RedisManager.getInstance().sendToDbQueue("db_processor", {
      type: "CREATE_DB_ORDER",
      data: {
        order_id: order.orderId,
        symbol: market,
        user_id: order.userId,
        time: order.time,
        price: parseFloat(order.price.toFixed(2)),
        qty: parseFloat(order.quantity.toFixed(2)),
        filled: parseFloat(order.filled.toFixed()),
        status: order.status,
        side: order.side,
      },
    });
  }

  updateDbOrders(fills: Fill[]) {
    fills.forEach((fill) => {
      RedisManager.getInstance().sendToDbQueue("db_processor", {
        type: "UPDATE_DB_ORDER",
        data: {
          order_id: fill.markerOrderId,
          qty: parseFloat(fill.qty.toFixed()),
          status: fill.otherOrderStatus,
        },
      });
    });
  }

  createDbTrades(
    fills: Fill[],
    market: string,
    userId: string,
    side: "buy" | "sell",
    orderId: string
  ) {
    fills.forEach((fill) => {
      RedisManager.getInstance().sendToDbQueue("db_processor", {
        type: "CREATE_DB_TRADE",
        data: {
          trade_id: fill.tradeId,
          time: new Date(),
          market: market,
          price: parseFloat(fill.price.toFixed(2)),
          quantity: parseFloat(fill.qty.toFixed(2)),
          is_buyer_maker: fill.otherUserId == userId,
          buyer_id: side == "buy" ? userId : fill.otherUserId,
          seller_id: side == "sell" ? userId : fill.otherUserId,
        },
      });
    });
  }

  publishWsTrades(fills: Fill[], userId: string, market: string) {
    fills.forEach((fill) => {
      RedisManager.getInstance().publishToWs(`trade.${market}`, {
        stream: `trade.${market}`,
        data: {
          e: "trade",
          t: fill.tradeId,
          m: fill.otherUserId === userId,
          p: parseFloat(fill.price.toFixed(2)),
          q: parseFloat(fill.qty.toFixed(2)),
          s: market,
          T: new Date(),
        },
      });
    });
  }

  publishWsDepthUpdates(
    fills: Fill[],
    price: number,
    side: "buy" | "sell",
    market: string,
    orderbook: OrderBook
  ) {
    const depth = orderbook.getDepths();
    if (side == "buy") {
      const price_fills = fills.map((f) => f.price);
      //depth m se vo saari prices and unki quantities ko filter kro jo prices fills m h .. kyunki unhi prices m changes aaya hoga.
      const updatedAsks = depth.asks.filter((a) =>
        price_fills.includes(Number(a[0]))
      );
      const updatedBids = depth.bids.find((b) => Number(b[0]) === price);
      RedisManager.getInstance().publishToWs(`depth.${market}`, {
        stream: `depth.${market}`,
        data: {
          a: updatedAsks,
          b: updatedBids ? [updatedBids] : [],
          e: "depth",
        },
      });
    } else {
      const price_fills = fills.map((f) => f.price);
      //depth m se vo saari prices and unki quantities ko filter kro jo prices fills m h .. kyunki unhi prices m changes aaya hoga.
      const updatedBids = depth.bids.filter((a) =>
        price_fills.includes(Number(a[0]))
      );
      const updatedAsks = depth.asks.find((b) => Number(b[0]) === price);
      RedisManager.getInstance().publishToWs(`depth.${market}`, {
        stream: `depth.${market}`,
        data: {
          a: updatedAsks ? [updatedAsks] : [],
          b: updatedBids,
          e: "depth",
        },
      });
    }
  }

  //for buying --> reduce the available balance and increase the locked balance.
  //for selling --> reduce the available asset and increase the locked asset.
  LockFunds(
    baseAsset: string,
    quoteAsset: string,
    quantity: number,
    price: number,
    side: "buy" | "sell",
    userId: string
  ) {
    if (side == "buy") {
      const user_balance = this.balances.get(userId);
      if (user_balance && user_balance[quoteAsset]) {
        const available_QuoteAsset = user_balance[quoteAsset].available;
        const locked_QuoteAsset = user_balance[quoteAsset].locked;
        if (available_QuoteAsset < price * quantity) {
          throw new Error("Insufficient balance!");
        } else {
          user_balance[quoteAsset].available =
            available_QuoteAsset - price * quantity;
          user_balance[quoteAsset].locked =
            locked_QuoteAsset + price * quantity;
        }
      } else {
        throw new Error("No user found !");
      }
    } else {
      const user_balance = this.balances.get(userId);
      if (user_balance && user_balance[baseAsset]) {
        const available_BaseAsset = user_balance[baseAsset].available;
        const locked_BaseAsset = user_balance[baseAsset].locked;
        if (available_BaseAsset < quantity) {
          throw new Error("Insufficient Funds!");
        } else {
          user_balance[baseAsset].available = available_BaseAsset - quantity;
          user_balance[baseAsset].locked = locked_BaseAsset + quantity;
        }
      } else {
        throw new Error("No user found !");
      }
    }
  }

  updateBalance(
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    fills: Fill[]
  ) {
    if (side == "buy") {
      fills.forEach((fill) => {
        const my_balance = this.balances.get(userId);
        const other_balance = this.balances.get(fill.otherUserId);
        if (
          my_balance &&
          my_balance[quoteAsset] &&
          my_balance[baseAsset] &&
          other_balance &&
          other_balance[quoteAsset] &&
          other_balance[baseAsset]
        ) {
          //My-balance
          //QuoteAsset (USDC) --> Locked USDC will be reducted.
          //baseAsset (SOL) --> Availale will be increased.
          my_balance[quoteAsset].locked =
            my_balance[quoteAsset].locked - fill.qty * fill.price;
          my_balance[baseAsset].available =
            my_balance[baseAsset].available + fill.qty;

          //other-balance
          //QuoteAsset (USDC) --> Available USDC will be increased.
          //baseAsset (SOL) --> locked SOL will be reducted.
          other_balance[quoteAsset].available =
            other_balance[quoteAsset].available + fill.qty * fill.price;
          other_balance[baseAsset].locked =
            other_balance[baseAsset].locked - fill.qty;
        } else {
          throw new Error("No balances found!");
        }
      });
    } else {
      fills.forEach((fill) => {
        const my_balance = this.balances.get(userId);
        const other_balance = this.balances.get(fill.otherUserId);
        if (
          my_balance &&
          my_balance[quoteAsset] &&
          my_balance[baseAsset] &&
          other_balance &&
          other_balance[quoteAsset] &&
          other_balance[baseAsset]
        ) {
          //My-balance
          //QuoteAsset (USDC) --> Available USDC will be increased.
          //baseAsset (SOL) --> Locked SOL will be reducted.
          my_balance[quoteAsset].available =
            my_balance[quoteAsset].available + fill.qty * fill.price;
          my_balance[baseAsset].locked =
            my_balance[baseAsset].locked - fill.qty;

          //other-balance
          //QuoteAsset (USDC) --> Locked USDC will be reducted.
          //baseAsset (SOL) --> Available SOL will be increased.
          other_balance[quoteAsset].locked =
            other_balance[quoteAsset].locked - fill.qty * fill.price;
          other_balance[baseAsset].available =
            other_balance[baseAsset].available + fill.qty;
        } else {
          throw new Error("No balances found!");
        }
      });
    }
  }

  cancelOrder(market: string, orderId: string): { cancelled_order: Order } {
    const orderbook = this.orderbooks.find(
      (orderbook) => orderbook.ticker() == market
    );
    if (!orderbook) {
      throw new Error("No orderbook found!");
    }
    const quoteAsset = orderbook.quoteAsset;
    const baseAsset = orderbook.baseAsset;
    //finding the order of orderId.
    const open_order =
      orderbook.bids.find((o) => o.orderId == orderId) ||
      orderbook.asks.find((o) => o.orderId == orderId);
    if (!open_order) {
      throw new Error("No order found");
    }
    this.updateBalance_cancelled(open_order, quoteAsset, baseAsset);
    if (open_order.side == "buy") {
      orderbook.cancelBid(orderId);
      this.updateDbOrders_cancelled(orderId);
      this.publishWsDepthUpdates_cancelled(
        open_order.price,
        orderbook,
        "buy",
        market
      );
      //for bookTicker --> the bids and the asks will always be sorted in any case.
      //just pick the top one.
      this.publishBookTickerUpdated_cancelled(orderbook, market);
    } else {
      orderbook.cancelAsk(orderId);
      this.updateDbOrders_cancelled(orderId);
      this.publishWsDepthUpdates_cancelled(
        open_order.price,
        orderbook,
        "sell",
        market
      );
      //for bookTicker --> the bids and the asks will always be sorted in any case.
      //just pick the top one.
      this.publishBookTickerUpdated_cancelled(orderbook, market);
    }
    return { cancelled_order: open_order };
  }

  publishBookTickerUpdated_cancelled(orderbook: OrderBook, market: string) {
    const currentPrice = orderbook.currentPrice;

    const { bid, ask } = orderbook.getBestBidsAsks();

    const fairPrice = (bid + ask) / 2;

    RedisManager.getInstance().publishToWs(`bookTicker@${market}`, {
      stream: `bookTicker@${market}`,
      data: {
        e: "bookTicker",
        currentPrice,
        fairPrice,
      },
    });
  }
  publishWsDepthUpdates_cancelled(
    price: number,
    orderbook: OrderBook,
    side: "buy" | "sell",
    market: string
  ) {
    const depth = orderbook.getDepths();
    if (side == "buy") {
      //this cancelled_order was on the bids.
      //in bids : ye order jis price m place hua hoga usi price m change aaya hoga.
      //in asks : no change.
      const updatedBids = depth.bids.find((b) => Number(b[0]) == price);
      RedisManager.getInstance().publishToWs(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          e: "depth",
          a: [],
          b: updatedBids ? [updatedBids] : [[price.toString(), "0"]],
        },
      });
    } else {
      //this cancelled_order was on the asks.
      //in asks : ye order jis price m place hua hoga usi price m change aaya hoga.
      //in bids : no change.
      const updatedAsks = depth.asks.find((b) => Number(b[0]) == price);
      RedisManager.getInstance().publishToWs(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          e: "depth",
          a: updatedAsks ? [updatedAsks] : [[price.toString(), "0"]],
          b: [],
        },
      });
    }
  }

  updateDbOrders_cancelled(orderId: string) {
    RedisManager.getInstance().sendToDbQueue("db_processor", {
      type: "UPDATE_DB_ORDER",
      data: {
        order_id: orderId,
        qty: 0,
        status: "cancelled",
      },
    });
  }

  updateBalance_cancelled(
    open_order: Order,
    quoteAsset: string,
    baseAsset: string
  ) {
    if (open_order.side == "buy") {
      //Quote-Asset --> increase the available balance.....reduce the locked balance.
      const UserBalance = this.balances.get(open_order.userId);
      if (UserBalance && UserBalance[quoteAsset]) {
        UserBalance[quoteAsset].available +=
          (open_order.quantity - open_order.filled) * open_order.price;
        UserBalance[quoteAsset].locked -=
          (open_order.quantity - open_order.filled) * open_order.price;
      } else {
        throw new Error("No balances found!");
      }
    } else {
      //base-Asset --> increase the available asset.....reduce the locked asset.
      const UserBalance = this.balances.get(open_order.userId);
      if (UserBalance && UserBalance[quoteAsset]) {
        UserBalance[baseAsset].available +=
          open_order.quantity - open_order.filled;
        UserBalance[baseAsset].locked -=
          open_order.quantity - open_order.filled;
      } else {
        throw new Error("No balances found!");
      }
    }
  }
}
