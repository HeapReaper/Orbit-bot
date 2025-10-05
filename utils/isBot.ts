import {
  Client,
  PartialUser,
  User,
} from "discord.js";

export function isBot(userObject: User | PartialUser, client: Client) {
  return userObject.id === client.user?.id || userObject.bot;
}