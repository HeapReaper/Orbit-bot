// @ts-ignore
import express from "express";
import { Logging } from "@utils/logging";
import {Client} from "discord.js";

export async function createWebServer(client: Client, port = 3144) {
  const webApp = express();

  webApp.get("/health", async (req: any, res: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send("OK");
  });

  webApp.listen(port, () => {
    Logging.info(`API running at http://localhost:${port}`);
  });

  return webApp;
}
