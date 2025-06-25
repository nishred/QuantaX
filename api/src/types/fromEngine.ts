export type MessageFromEngine = {
    type: "ORDER_PLACED",
    payload: {
        orderId: string,
        executedQty: number,
        fills: [
            {
                price: number,
                qty: number,
                tradeId: number
            }
        ]
    }
} | {
    type : "DEPTH",
    payload : {
        asks : [string,string][],
        bids : [string,string][]
    }
} | {
    type : "OPEN_ORDERS",
    payload : {
        asks : Order[],
        bids : Order[]
    }
} | {
    type: "ORDER_CANCELLED",
    payload: {
        orderId: string,
        executedQty: number,
        remainingQty: number
    }
} | {
    type : "BALANCE",
    payload : {
        balances : {
            [key : string] : {
                available : number,
                locked : number
            }
        }
    }
} | {
    type : "MARKET_ADDED",
    payload : {
        success : boolean,
        message : string
    }
} | {
    type : "USER_CREATED",
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
    type : "ORDER_FAILED",
    payload : {
        message : string
    }
}


interface Order {
    orderId : string,
    userId : string,
    price : number,
    quantity : number,
    side : "buy" | "sell",
    filled: number,
    time : Date,
    status : ORDER_STATUS
}
type ORDER_STATUS = "new" | "filled" | "cancelled" | "partially_filled";