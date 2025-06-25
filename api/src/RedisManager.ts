import { createClient, RedisClientType } from "redis";
import { MessageToEngine } from "./types/toEngine";
import {v4 as uuid} from "uuid"
import { MessageFromEngine } from "./types/fromEngine";

export class RedisManager {
    private client : RedisClientType;
    private queue : RedisClientType;
    private static instance : RedisManager;

    private constructor(){
        this.client = createClient();
        this.queue = createClient();
        this.client.connect();
        this.queue.connect();
    }

    public static getInstance() {
        if (!this.instance)  {
            this.instance = new RedisManager();
        }
        return this.instance;
    }

    public sendAndAwait(message : MessageToEngine) {
        return new Promise<MessageFromEngine>((resolve) => {
            //publishing on PUB_SUBS;
            const clientId : string = uuid();
            this.client.subscribe(clientId, (dataFromEngine : string) => {
                this.client.unsubscribe(clientId);
                resolve(JSON.parse(dataFromEngine) as MessageFromEngine);
            });
            //Sending to Queue ....( to engine ultimately ) 
            this.queue.lPush("messages", JSON.stringify({ clientId , message }));
        });
    }
}