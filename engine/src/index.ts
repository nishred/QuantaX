import { createClient } from "redis";
import { Engine } from "./trade/engine";

async function main() {
  const engine = new Engine();
  const redisClient = createClient();

  setInterval(() => {
    console.log(engine.getState());
  }, 1000 * 60);

  try {
    await redisClient.connect();
    console.log("Connected to redis");
  } catch (error) {
    console.log("Error while connecting to redis !");
  }

  while (true) {
    const response = await redisClient.brPop("messages", 0);
    if (response) {
      engine.process(JSON.parse(response.element));
    }
  }
}
main();
