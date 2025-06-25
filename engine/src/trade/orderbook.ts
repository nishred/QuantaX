//if i place an order...and my half qty is filled by orderId = 2....and i ate whole qty of orderId = 2....the orderId = 2 will be removed from the orderBook.
//how will the person with orderId = 2 will know ki uska pura filled ho gya tha. ????

import { ORDER_STATUS } from "../types";

//Check if the user itself doesn't trade with himself
export interface Order {
  orderId: string;
  userId: string;
  price: number;
  quantity: number;
  side: "buy" | "sell";
  filled: number;
  time: Date;
  status: ORDER_STATUS;
}

export interface Fill {
  price: number;
  qty: number;
  tradeId: number;
  otherUserId: string;
  markerOrderId: string;
  otherOrderStatus: ORDER_STATUS;
}

export class OrderBook {
  bids: Order[];
  asks: Order[];
  baseAsset: string;
  quoteAsset: string;
  lastTradeId: number;
  currentPrice: number;

  constructor(
    baseAsset: string,
    quoteAsset: string,
    bids: Order[],
    asks: Order[],
    lastTradeId: number,
    currentPrice: number
  ) {
    this.bids = bids;
    this.asks = asks;
    this.baseAsset = baseAsset;
    this.quoteAsset = quoteAsset;
    this.lastTradeId = lastTradeId || 0;
    this.currentPrice = currentPrice || 0;
  }

  //It returns the market of the orderbook.
  ticker() {
    return `${this.baseAsset}_${this.quoteAsset}`;
  }

  getSnapshot() {
    return {
      quoteAsset: this.quoteAsset,
      baseAsset: this.baseAsset,
      bids: this.bids,
      asks: this.asks,
      lastTradeId: this.lastTradeId,
      currentPrice: this.currentPrice,
    };
  }

  getOpenOrders(userId: string) {
    const asks = this.asks.filter((order) => order.userId == userId);
    const bids = this.bids.filter((order) => order.userId == userId);
    return {
      asks: asks,
      bids: bids,
    };
  }

  getDepths(): { asks: [string, string][]; bids: [string, string][] } {
    const aggregated_bids: [string, string][] = [];
    const aggregated_asks: [string, string][] = [];

    //Will be like a map to store (price) and its (quantity).
    //It's like ... iss price m TOTAL itna quantity h.
    const bids_obj: { [key: string]: number } = {};
    const asks_obj: { [key: string]: number } = {};

    this.bids.forEach((order) => {
      const price = order.price;

      //if ( price : quantity ) is not created in bids_obj --> then create it with 0 quantity.
      if (!bids_obj[price]) {
        bids_obj[price] = 0;
      }
      bids_obj[price] = bids_obj[price] + order.quantity - order.filled;
    });

    this.asks.forEach((order) => {
      const price = order.price;

      //if ( price : quantity ) is not created in asks_obj --> then create it with 0 quantity.
      if (!asks_obj[price]) {
        asks_obj[price] = 0;
      }
      asks_obj[price] = asks_obj[price] + order.quantity - order.filled;
    });

    for (const price in bids_obj) {
      aggregated_bids.push([price, bids_obj[price].toString()]);
    }
    for (const price in asks_obj) {
      aggregated_asks.push([price, asks_obj[price].toString()]);
    }

    return { bids: aggregated_bids, asks: aggregated_asks };
  }

  addOrder(order: Order): { fills: Fill[]; executedQty: number } {
    if (order.side == "buy") {
      const { fills, executedQty } = this.match_buyToAsks(order);
      order.filled = executedQty;
      const status =
        executedQty == 0
          ? "new"
          : executedQty == order.quantity
          ? "filled"
          : "partially_filled";
      order.status = status;

      // if the order is completely filled, then return the fills and executedQty and dont add it to the order book.
      if (executedQty == order.quantity) {
        return {
          fills,
          executedQty,
        };
      }
      this.bids.push(order);
      return {
        fills,
        executedQty,
      };
    } else {
      const { executedQty, fills } = this.match_sellToBids(order);
      order.filled = executedQty;
      const status =
        executedQty == 0
          ? "new"
          : executedQty == order.quantity
          ? "filled"
          : "partially_filled";
      order.status = status;
      if (executedQty === order.quantity) {
        return {
          executedQty,
          fills,
        };
      }
      this.asks.push(order);
      return {
        executedQty,
        fills,
      };
    }
  }

  //If i want to buy ... my order will be matched in the asks.
  //Order will be matched starting from the best to worst asks.
  //Least asks is the best asks.
  //so, Sort in ascending order....start from first.
  match_buyToAsks(order: Order): { fills: Fill[]; executedQty: number } {
    const fills: Fill[] = [];
    let executedQty: number = 0;
    this.asks.sort((o1, o2) => o1.price - o2.price);
    for (let i = 0; i < this.asks.length; i++) {
      if (this.asks[i].price <= order.price && order.quantity > executedQty) {
        const remainingQty = order.quantity - executedQty;
        const filledQty = Math.min(
          remainingQty,
          this.asks[i].quantity - this.asks[i].filled
        );

        if (filledQty > 0) {
          this.lastTradeId++;

          this.currentPrice = this.asks[i].price;
        }

        executedQty = executedQty + filledQty;
        this.asks[i].filled = this.asks[i].filled + filledQty;
        this.asks[i].status =
          this.asks[i].filled == this.asks[i].quantity
            ? "filled"
            : "partially_filled";
        fills.push({
          price: this.asks[i].price,
          qty: filledQty,
          tradeId: this.lastTradeId,
          otherUserId: this.asks[i].userId,
          markerOrderId: this.asks[i].orderId,
          otherOrderStatus: this.asks[i].status,
        });
      } else {
        break;
      }
    }
    return {
      fills,
      executedQty,
    };
  }

  //If i want to sell ... my order will be matched in the bids.
  //Order will be matched starting from the best to worst bids.
  //highest bids is the best bids.
  //so, Sort in descending order....start from first.
  match_sellToBids(order: Order): { fills: Fill[]; executedQty: number } {
    const fills: Fill[] = [];
    let executedQty: number = 0;
    this.bids.sort((o1, o2) => o2.price - o1.price);
    for (let i = 0; i < this.bids.length; i++) {
      if (this.bids[i].price >= order.price && order.quantity > executedQty) {
        const remainingQty = order.quantity - executedQty;
        const filledQty = Math.min(
          remainingQty,
          this.bids[i].quantity - this.bids[i].filled
        );

        if (filledQty > 0) {
          this.lastTradeId++;

          this.currentPrice = this.bids[i].price;
        }

        executedQty = executedQty + filledQty;
        this.bids[i].filled = this.bids[i].filled + filledQty;
        this.bids[i].status =
          this.bids[i].filled == this.bids[i].quantity
            ? "filled"
            : "partially_filled";
        fills.push({
          price: this.bids[i].price,
          qty: filledQty,
          tradeId: this.lastTradeId,
          otherUserId: this.bids[i].userId,
          markerOrderId: this.bids[i].orderId,
          otherOrderStatus: this.bids[i].status,
        });
      }
    }
    return {
      fills,
      executedQty,
    };
  }

  cancelBid(orderId: string) {
    const index = this.bids.findIndex((b) => b.orderId == orderId);
    if (index != -1) {
      this.bids.splice(index, 1);
    }
  }
  cancelAsk(orderId: string) {
    const index = this.asks.findIndex((a) => a.orderId == orderId);
    if (index != -1) {
      this.asks.splice(index, 1);
    }
  }
  cleanUp() {
    for (let i = 0; i < this.asks.length; i++) {
      if (
        this.asks[i].status == "cancelled" ||
        this.asks[i].status == "filled"
      ) {
        this.asks.splice(i, 1);
        i--;
      }
    }
    for (let i = 0; i < this.bids.length; i++) {
      if (
        this.bids[i].status == "cancelled" ||
        this.bids[i].status == "filled"
      ) {
        this.bids.splice(i, 1);
        i--;
      }
    }
  }
  getBestBidsAsks(): {
    bid: number;
    ask: number;
  } {
    const bestBid = this.bids.sort((b1, b2) => b2.price - b1.price)[0];

    const bestAsk = this.asks.sort((a1, a2) => a1.price - a2.price)[0];

    const bid = bestBid ? bestBid.price : 0;
    const ask = bestAsk ? bestAsk.price : 0;

    return {
      bid,
      ask,
    };
  }
}
