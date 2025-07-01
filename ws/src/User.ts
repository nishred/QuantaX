import WebSocket from "ws";
import { IncomingMessage } from "./types/fromBrowser";
import { SubscriptionManager } from "./SubscriptionManager";
import { OutgoingMessage } from "./types/toBrowser";
import { UserManager } from "./UserManager";

//not a singleton class ... since there can be many users
export class User {
  private userId: string;
  private ws: WebSocket;

  constructor(userId: string, ws: WebSocket) {
    this.userId = userId;
    this.ws = ws;
    this.messageListener();
    this.closeListener();
  }

  private messageListener() {
    console.log("listening for userId : " + this.userId);
    this.ws.on("message", (message: string) => {
      const parsedMessage: IncomingMessage = JSON.parse(message);
      console.log(parsedMessage);
      try {
        if (parsedMessage.method == "SUBSCRIBE") {
          parsedMessage.params.forEach((channel) =>
            SubscriptionManager.getInstance().subscribe(this.userId, channel)
          );
        } else {
          parsedMessage.params.forEach((channel) =>
            SubscriptionManager.getInstance().unsubscribe(this.userId, channel)
          );
        }
      } catch (error) {
        console.log(error);
      }
    });
  }

  private closeListener() {
    this.ws.on("close", () => {
      UserManager.getInstance().deleteUser(this.userId);
      console.log(this.userId + "   userId deleted");
      SubscriptionManager.getInstance().leftUser(this.userId);
    });
  }

  emit(message: OutgoingMessage) {
    this.ws.send(JSON.stringify(message));
  }
}
