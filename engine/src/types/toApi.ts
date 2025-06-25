import { UserBalance } from "../trade/engine"
import { Order } from "../trade/orderbook"

export type MessageToApi = {
    type: "ORDER_PLACED",
    payload: {
        orderId: string,
        executedQty: number,
        fills: {
            price: number,
            qty: number,
            tradeId: number
        }[]
        
    }
} | {
    type: "ORDER_CANCELLED",
    payload: {
        orderId: string,
        executedQty: number,
        remainingQty: number,
    }
} | {
    type : "OPEN_ORDERS",
    payload : {
        asks : Order[],
        bids : Order[]
    }
} | {
    type : "DEPTH",
    payload : {
        asks : [string,string][],
        bids : [string,string][]
    }
} | {
    type : "BALANCE",
    payload : {
        balances : UserBalance
    }
} | {
    type : "USER_CREATED",
    payload : {
        success : boolean,
        message : string
    }
} | {
    type : "MARKET_ADDED",
    payload : {
        success : boolean,
        message : string
    }
} | {
    type: "CANCEL_ORDER_FAILED",
    payload: {
        executedQty: number,
        remainingQty: number,
        message : string
    }
} | {
    type : "BOT_ADDED",
    payload : {
        success : boolean,
        message : string
    }
} | {
    type: "ORDER_FAILED",
    payload: {
        message : string
    }
}