import {
  TextChannel,
  EmbedBuilder,
  ColorResolvable,
  Attachment
} from "discord.js";

export class LogToServer {
  private static logChannel: TextChannel;
  private static defaultThumbnail?: string | Attachment;

  static init(logChannel: TextChannel, defaultThumbnail?: string | Attachment) {
    this.logChannel = logChannel;
    this.defaultThumbnail = defaultThumbnail;
  }

  static async sendLog(options: {
    title: string;
    color?: ColorResolvable;
    fields?: { name: string; value: string; inline?: boolean }[];
    thumbnail?: string | Attachment;
    files?: (string | Attachment)[];
  }) {
    if (!this.logChannel) throw new Error("LogToServer not initialized. Call LogToServer.init() first.");

    const embed = new EmbedBuilder()
      .setTitle(options.title)
      .setColor(options.color ?? "Blurple")
      // @ts-ignore
      .setThumbnail(options.thumbnail ?? this.defaultThumbnail ?? undefined);

    if (options.fields) embed.addFields(...options.fields);

    await this.logChannel.send({ embeds: [embed], files: options.files ?? [] });
  }

  static async info(title: string, fields?: { name: string; value: string; inline?: boolean }[], thumbnail?: string | Attachment) {
    await this.sendLog({ title, color: "Green", fields, thumbnail });
  }

  static async warning(title: string, fields?: { name: string; value: string; inline?: boolean }[], thumbnail?: string | Attachment) {
    await this.sendLog({ title, color: "Orange", fields, thumbnail });
  }

  static async error(title: string, fields?: { name: string; value: string; inline?: boolean }[], thumbnail?: string | Attachment) {
    await this.sendLog({ title, color: "Red", fields, thumbnail });
  }
}