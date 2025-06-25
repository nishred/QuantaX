export type OutgoingMessage = {
    stream : string,
    data : {
        a : [string,string][],
        b : [string,string][],
        e : "depth"
    }
} | {
    stream : string,
    data: {
        e: "trade",
        t: number,
        m: boolean,
        p: number,
        q: number,
        s: string,
    }
} | {
    stream : string,
    data : {
        e : "bookTicker",
        s : string,
        a : string,   //best ask price
        A : string,   //best ask qty
        b : string,
        B : string
    }
}
