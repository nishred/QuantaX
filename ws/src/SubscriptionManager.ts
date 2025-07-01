import { createClient, RedisClientType } from "redis";
import { UserManager } from "./UserManager";
import { OutgoingMessage } from "./types/toBrowser";

export class SubscriptionManager {
    private static instance : SubscriptionManager;
    private subscriptions : Map<string , string[]>;  //user id, streams
    private reverseSubscription : Map<string , string[]>;  //stream, user ids
    private redisClient : RedisClientType;

    private constructor(){
        this.subscriptions = new Map();
        this.reverseSubscription = new Map();
        this.redisClient = createClient();
        try {   
            this.redisClient.connect();
            console.log("Redis connected");
        } catch (error) {
            console.log("Error while connecting to redis !")
        }
    }

    public static getInstance(){
        if(!this.instance){
            return this.instance = new SubscriptionManager();
        }
        return this.instance;
    }

    public subscribe(userId : string,channel : string){
        const all_channels = this.subscriptions.get(userId);
        const all_users = this.reverseSubscription.get(channel);
        if(all_channels && all_channels.includes(channel) && all_users && all_users.includes(userId)){
            return;
        }


        this.subscriptions.set(userId , (all_channels || []).concat(channel))
        this.reverseSubscription.set(channel , (all_users || []).concat(userId))


        if(this.reverseSubscription.get(channel)?.length == 1){
            console.log("subscribing to " + channel)
            this.redisClient.subscribe(channel, (messageFromEngine : string ) => {
                const all_Subscribed_Users = this.reverseSubscription.get(channel);
                const parsedMessage = JSON.parse(messageFromEngine) as OutgoingMessage
                if(all_Subscribed_Users){
                    all_Subscribed_Users.forEach(userId => UserManager.getInstance().getUser(userId)?.emit(parsedMessage))
                }
            })
        }
        console.log(this.subscriptions);
    }

    public unsubscribe(userId : string, channel : string){
        const all_channels = this.subscriptions.get(userId);
        if(all_channels){
            const remaining_channels = all_channels.filter(c => c != channel)
            this.subscriptions.set(userId , remaining_channels)
        }

        const all_users = this.reverseSubscription.get(channel);
        if(all_users){
            const remaining_users = all_users.filter(u => u != userId)
            this.reverseSubscription.set(channel , remaining_users);

            if(this.reverseSubscription.get(channel)?.length == 0){
                this.reverseSubscription.delete(channel);
                console.log("Unsubscribing from " + channel)
                this.redisClient.unsubscribe(channel)
            }
        }
        console.log(this.subscriptions);
    }


    leftUser(userId : string){
        const all_channels = this.subscriptions.get(userId);
        if(all_channels){
            all_channels.forEach(channel => this.unsubscribe(userId,channel))
        }
    }
}