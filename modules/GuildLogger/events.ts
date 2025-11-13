import {
  Client,
  Events as DiscordEvents,
  Message,
  GuildMember,
  PartialGuildMember,
  PartialMessage,
  GuildBan,
  EmbedBuilder,
  TextChannel,
  Colors,
  Role,
  GuildChannel,
  ThreadChannel,
  VoiceState,
  GuildScheduledEvent,
  Interaction,
  AuditLogEvent
} from "discord.js";
import { getRedisClient } from "@utils/redis";
import { prisma } from "@utils/prisma";
import getGuildSettings from "@utils/getGuildSettings";
import { t } from "@utils/i18n";
import process from "node:process";

const redis = getRedisClient();
let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    // Message Events
    this.client.on(DiscordEvents.MessageDelete, (msg) => this.messageDelete(msg));
    this.client.on(DiscordEvents.MessageBulkDelete, (msgs) => this.messagesBulkDelete(msgs));
    this.client.on(DiscordEvents.MessageUpdate, (oldMsg, newMsg) => this.messageUpdate(oldMsg, newMsg));
    this.client.on(DiscordEvents.MessageReactionAdd, (reaction, user) => this.reactionAdd(reaction, user));
    this.client.on(DiscordEvents.MessageReactionRemove, (reaction, user) => this.reactionRemove(reaction, user));
    this.client.on(DiscordEvents.MessageReactionRemoveAll, (msg) => this.reactionsCleared(msg));
    //this.client.on(DiscordEvents.MessagePin, (msg) => this.messagePinned(msg));
    //this.client.on(DiscordEvents.MessageUnpin, (msg) => this.messageUnpinned(msg));

    // Member Events
    this.client.on(DiscordEvents.GuildMemberAdd, (member) => this.memberJoined(member));
    this.client.on(DiscordEvents.GuildMemberRemove, (member) => this.memberLeft(member));
    this.client.on(DiscordEvents.GuildMemberUpdate, async (oldMember, newMember) => {
      await this.memberUpdated(oldMember, newMember);
      await this.memberTimeout(oldMember, newMember);
      await this.memberRoleChange(oldMember, newMember);
    });
    this.client.on(DiscordEvents.GuildBanAdd, (ban) => this.memberBanned(ban));
    this.client.on(DiscordEvents.GuildBanRemove, (ban) => this.memberUnbanned(ban));

    // Voice Events
    this.client.on(DiscordEvents.VoiceStateUpdate, (oldState, newState) => this.voiceStateChanged(oldState, newState));
    
    // Role Events
    this.client.on(DiscordEvents.GuildRoleCreate, (role) => this.roleCreated(role));
    this.client.on(DiscordEvents.GuildRoleDelete, (role) => this.roleDeleted(role));
    this.client.on(DiscordEvents.GuildRoleUpdate, (oldRole, newRole) => this.roleUpdated(oldRole, newRole));

    // Channel Events
    this.client.on(DiscordEvents.ChannelCreate, (channel) => this.channelCreated(channel));
    this.client.on(DiscordEvents.ChannelDelete, (channel) => this.channelDeleted(channel));
    this.client.on(DiscordEvents.ChannelUpdate, (oldChannel, newChannel) => this.channelUpdated(oldChannel, newChannel));
    this.client.on(DiscordEvents.ChannelPinsUpdate, (channel, time) => this.channelPinsUpdated(channel, time));

    // Thread Events
    this.client.on(DiscordEvents.ThreadCreate, (thread) => this.threadCreated(thread));
    this.client.on(DiscordEvents.ThreadDelete, (thread) => this.threadDeleted(thread));
    this.client.on(DiscordEvents.ThreadUpdate, (oldThread, newThread) => this.threadUpdated(oldThread, newThread));
    this.client.on(DiscordEvents.ThreadMemberUpdate, (oldMember, newMember) => this.threadMemberChange(oldMember, newMember));

    // Guild Events
    this.client.on(DiscordEvents.GuildUpdate, (oldGuild, newGuild) => this.guildUpdated(oldGuild, newGuild));
    this.client.on(DiscordEvents.GuildIntegrationsUpdate, (guild) => this.guildIntegrationsUpdated(guild));
    this.client.on(DiscordEvents.GuildEmojisUpdate, (guild, oldEmojis, newEmojis) => this.guildEmojisUpdated(guild));
    this.client.on(DiscordEvents.GuildStickersUpdate, (guild, oldStickers, newStickers) => this.guildStickersUpdated(guild));
    this.client.on(DiscordEvents.GuildScheduledEventCreate, (event) => this.guildScheduledEventCreated(event));
    this.client.on(DiscordEvents.GuildScheduledEventDelete, (event) => this.guildScheduledEventDeleted(event));
    this.client.on(DiscordEvents.GuildScheduledEventUpdate, (oldEvent, newEvent) => this.guildScheduledEventUpdated(oldEvent, newEvent));
    
    // Bot & Auto Moderation
    this.client.on(DiscordEvents.InteractionCreate, (interaction) => this.botCommandUsed(interaction));
    this.client.on(DiscordEvents.GuildAutoModerationRuleCreate, (rule) => this.autoModerationTriggered(rule));
  }

  // Helpers
  private async persistGuildLog(guildId: string, type: string, message: string) {
    try {
      await prisma.guildLog.create({
        data: {
          guildId,
          type,
          message,
        },
      });
    } catch (err) {
      console.error(`Failed to persist log for guild ${guildId}:`, err);
    }
  }

  private async getGuildLanguage(guildId: string) {
    const guildSettings = await getGuildSettings(guildId);
    return guildSettings?.language || "en"; // Default english if no language was found
  }

  private async isEventEnabled(guildId: string, eventKey: string) {
    const cacheKey = `logging:${guildId}`;
    const cached = await redis.get(cacheKey);
    let data: any;
    if (cached) {
      try {
        data = JSON.parse(cached);
        return data.enabled && Array.isArray(data.events) && data.events.includes(eventKey);
      } catch {
        await redis.del(cacheKey);
      }
    }
    const settings = await prisma.loggingSettings.findUnique({ where: { guildId } });
    if (!settings || !settings.enabled) {
      await redis.set(cacheKey, JSON.stringify({ enabled: false }), "EX", 300);
      return false;
    }
    data = { enabled: settings.enabled, channel: settings.channel, events: settings.events || [] };
    await redis.set(cacheKey, JSON.stringify(data), "EX", 300);
    return data.enabled && Array.isArray(data.events) && data.events.includes(eventKey);
  }

  private async sendLogEmbed(guildId: string, embed: EmbedBuilder) {
    const cacheKey = `logging:${guildId}`;
    let settings: any;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try { settings = JSON.parse(cached); } catch { await redis.del(cacheKey); }
    }
    if (!settings) {
      settings = await prisma.loggingSettings.findUnique({ where: { guildId } });
      if (!settings) return;
      await redis.set(cacheKey, JSON.stringify(settings), "EX", 300);
    }
    if (!settings.channel) return;
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;
    const logChannel = guild.channels.cache.get(settings.channel);
    if (!logChannel || !logChannel.isTextBased()) return;

    // Dont log if it's debug
    if (process.env.ENVIRONMENT === "debug") return;

    await (logChannel as TextChannel).send({ embeds: [embed] });
  }

  private async logIfEnabled(guildId: string, eventKey: string, embed: EmbedBuilder) {
    if (!(await this.isEventEnabled(guildId, eventKey))) return;
    await this.sendLogEmbed(guildId, embed);
  }

  // Messages
  async messageDelete(message: Message | PartialMessage) {
    if (!message.guild) return;

    const lang = await this.getGuildLanguage(message.guild.id);
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(t(lang, "message_deleted"))
      .addFields(
        { name: t(lang, "user"), value: `<@${message.author?.id ?? "Unknown"}>` },
        { name: t(lang, "message"), value: message.content?.substring(0, 1000) ?? t(lang, "none") }
      )
      .setTimestamp();

    await this.logIfEnabled(message.guild.id, "message_delete", embed);
  }

  async messagesBulkDelete(messages: any) {
    const guild = messages.first()?.guild;
    if (!guild) return;

    const lang = await this.getGuildLanguage(guild.id);

    const embed = new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setTitle(t(lang, "messages_deleted"))
      .setDescription(`${t(lang, "count")}: **${messages.size}**`)
      .setTimestamp();
    await this.logIfEnabled(guild.id, "message_bulk_delete", embed);
  }

  async messageUpdate(oldMessage: Message | PartialMessage, newMessage: Message) {
    if (!oldMessage.guild || oldMessage.content === newMessage.content) return;

    const lang = await this.getGuildLanguage(oldMessage.guild.id);

    // Fetch full message if oldMessage is partial
    if (oldMessage.partial) {
      try {
        oldMessage = await oldMessage.fetch();
      } catch (err) {
        console.error("Failed to fetch old message:", err);
        return;
      }
    }

    if (oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "message_edit"))
      .addFields(
        { name: t(lang, "user"), value: `<@${newMessage.author?.id ?? "Unknown"}>` },
        { name: t(lang, "old_message"), value: oldMessage.content?.substring(0, 1000) ?? t(lang, "none") },
        { name: t(lang, "new_message"), value: newMessage.content?.substring(0, 1000) ?? t(lang, "none") }
      )
      .setTimestamp();

    // @ts-ignore
    await this.logIfEnabled(oldMessage.guild.id, "message_edit", embed);
  }

  async reactionAdd(reaction: any, user: any) {
    const guildId = reaction.message.guildId;
    if (!guildId) return;
    const lang = await this.getGuildLanguage(guildId);
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(t(lang, "reaction_added"))
      .addFields(
        { name: t(lang, "user"), value: `<@${user.id ?? "Unknown"}>` },
        { name: t(lang, "emoji"), value: `${reaction.emoji ?? t(lang, "none")}` },
        { name: t(lang, "message"), value: `${reaction.message.url ?? t(lang, "none")}` }
      )
      .setTimestamp();
    await this.logIfEnabled(guildId, "message_reaction_add", embed);
  }

  async reactionRemove(reaction: any, user: any) {
    const guildId = reaction.message.guildId;
    if (!guildId) return;
    const lang = await this.getGuildLanguage(guildId);
    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle(t(lang, "reaction_removed"))
      .addFields(
        { name: t(lang, "user"), value: `<@${user.id ?? "Unknown"}>` },
        { name: t(lang, "emoji"), value: `${reaction.emoji ?? t(lang, "none")}` },
        { name: t(lang, "message"), value: `${reaction.message.url ?? t(lang, "none")}` }
      )
      .setTimestamp();
    await this.logIfEnabled(guildId, "message_reaction_remove", embed);
  }

  async reactionsCleared(message: Message | PartialMessage) {
    if (!message.guild) return;
    const lang = await this.getGuildLanguage(message.guild.id);
    let clearedBy = t(lang, "unknown");
    try {
      const logs = await message.guild.fetchAuditLogs({ type: "MESSAGE_REACTION_REMOVE_ALL", limit: 1 });
      const entry = logs.entries.first();
      if (entry) clearedBy = `<@${entry.executor?.id}>`;
    } catch {}
    const embed = new EmbedBuilder()
      .setColor(Colors.DarkGrey)
      .setTitle(t(lang, "reactions_cleared"))
      .addFields({ name: t(lang, "message"), value: `${message.url ?? t(lang, "none")}` }, { name: t(lang, "cleared_by"), value: clearedBy })
      .setTimestamp();
    await this.logIfEnabled(message.guild.id, "message_reaction_clear", embed);
  }

  async messagePinned(message: Message | PartialMessage) {
    if (!message.guild) return;
    const lang = await this.getGuildLanguage(message.guild.id);

    let user = `<@${message.author?.id ?? "Unknown"}>`;
    try {
      const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessagePin, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for message pin:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(t(lang, "message_pin"))
      .addFields(
        { name: t(lang, "user"), value: user },
        { name: t(lang, "message"), value: message.content?.substring(0, 1000) ?? t(lang, "none") }
      )
      .setTimestamp();

    await this.logIfEnabled(message.guild.id, "message_pin", embed);
  }

  async messageUnpinned(message: Message | PartialMessage) {
    if (!message.guild) return;
    const lang = await this.getGuildLanguage(message.guild.id);

    let user = `<@${message.author?.id ?? "Unknown"}>`;
    try {
      const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageUnpin, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for message unpin:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(t(lang, "message_unpin"))
      .addFields(
        { name: t(lang, "user"), value: user },
        { name: t(lang, "message"), value: message.content?.substring(0, 1000) ?? t(lang, "none") }
      )
      .setTimestamp();

    await this.logIfEnabled(message.guild.id, "message_unpin", embed);
  }

  // Member events
  async memberJoined(member: GuildMember) {
    const lang = await this.getGuildLanguage(member.guild.id);

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(t(lang, "member_join"))
      .addFields(
        { name: t(lang, "user"), value: `<@${member.id}>` },
        { name: t(lang, "account_created"), value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
      )
      .setTimestamp();

    await this.logIfEnabled(member.guild.id, "member_join", embed);
  }

  async memberLeft(member: GuildMember | PartialGuildMember) {
    if (!member.guild) return;
    const lang = await this.getGuildLanguage(member.guild.id);

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(t(lang, "member_leave"))
      .addFields({ name: t(lang, "user"), value: `<@${member.id}>` })
      .setTimestamp();

    await this.logIfEnabled(member.guild.id, "member_leave", embed);
  }

  async memberUpdated(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    const lang = await this.getGuildLanguage(newMember.guild.id);

    // Fetch full member if oldMember is partial
    if (oldMember.partial) {
      try {
        oldMember = await oldMember.fetch();
      } catch (err) {
        console.error("Failed to fetch old member:", err);
        return;
      }
    }

    if (oldMember.displayName === newMember.displayName) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "member_update"))
      .setDescription(`<@${newMember.id}> ${t(lang, "member_updated")}`)
      .addFields(
        { name: t(lang, "old_name"), value: `${oldMember.displayName ?? "Unknown"}` },
        { name: t(lang, "new_name"), value: `${newMember.displayName ?? "Unknown"}` },
      )
      .setTimestamp();
    await this.logIfEnabled(newMember.guild.id, "member_update", embed);
  }

  async memberBanned(ban: GuildBan) {
    const lang = await this.getGuildLanguage(ban.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for member ban:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setTitle(t(lang, "member_ban"))
      .addFields(
        { name: t(lang, "user"), value: `${ban.user.tag}` },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(ban.guild.id, "member_ban", embed);
  }

  async memberUnbanned(ban: GuildBan) {
    const lang = await this.getGuildLanguage(ban.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for member unban:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(t(lang, "member_unban"))
      .addFields(
        { name: t(lang, "user"), value: `${ban.user.tag}` },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(ban.guild.id, "member_unban", embed);
  }

  async memberTimeout(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    if (!newMember.communicationDisabledUntil) return;
    const lang = await this.getGuildLanguage(newMember.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry?.changes.some(c => c.key === "communication_disabled_until")) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for timeout:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle(t(lang, "member_timeout"))
      .addFields(
        { name: t(lang, "user"), value: `<@${newMember.id}>` },
        { name: t(lang, "until"), value: `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>` },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(newMember.guild.id, "member_timeout", embed);
  }

  async memberRoleChange(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    const lang = await this.getGuildLanguage(newMember.guild.id);
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles?.cache.has(r.id));
    const removedRoles = oldMember.roles?.cache.filter(r => !newMember.roles.cache.has(r.id)) || [];

    let user = t(lang, "unknown");
    try {
      const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for role change:", err);
    }

    if (addedRoles.size > 0) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(t(lang, "member_role_add"))
        .addFields(
          { name: t(lang, "user"), value: `<@${newMember.id}>` },
          { name: t(lang, "roles"), value: addedRoles.map(r => r.name).join(", ") },
          { name: t(lang, "done_by"), value: user }
        )
        .setTimestamp();
      await this.logIfEnabled(newMember.guild.id, "member_role_add", embed);
    }

    if (removedRoles.size > 0) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle(t(lang, "member_role_remove"))
        .addFields(
          { name: t(lang, "user"), value: `<@${newMember.id}>` },
          { name: t(lang, "roles"), value: removedRoles.map(r => r.name).join(", ") },
          { name: t(lang, "done_by"), value: user }
        )
        .setTimestamp();
      await this.logIfEnabled(newMember.guild.id, "member_role_remove", embed);
    }
  }
  
  // Voice events
  async voiceStateChanged(oldState: VoiceState, newState: VoiceState) {
    if (!oldState.guild) return;
    const lang = await this.getGuildLanguage(oldState.guild.id);

    const memberTag = `<@${newState.member?.id}>`;

    // User joined voice
    if (!oldState.channel && newState.channel) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(t(lang, "voice_join"))
        .addFields(
          { name: t(lang, "user"), value: memberTag },
          { name: t(lang, "channel"), value: newState.channel.name }
        )
        .setTimestamp();
      await this.logIfEnabled(oldState.guild.id, "voice_join", embed);
    }
    // User left voice
    else if (oldState.channel && !newState.channel) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle(t(lang, "voice_leave"))
        .addFields(
          { name: t(lang, "user"), value: memberTag },
          { name: t(lang, "channel"), value: oldState.channel.name }
        )
        .setTimestamp();
      await this.logIfEnabled(oldState.guild.id, "voice_leave", embed);
    }
    // User switched channels
    else if (oldState.channelId !== newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle(t(lang, "voice_switch"))
        .addFields(
          { name: t(lang, "user"), value: memberTag },
          { name: t(lang, "from"), value: oldState.channel?.name ?? t(lang, "none") },
          { name: t(lang, "to"), value: newState.channel?.name ?? t(lang, "none") }
        )
        .setTimestamp();
      await this.logIfEnabled(oldState.guild.id, "voice_switch", embed);
    }

    // Mute/unmute
    if (!oldState.selfMute && newState.selfMute) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle(t(lang, "voice_mute"))
        .addFields({ name: t(lang, "user"), value: memberTag })
        .setTimestamp();
      await this.logIfEnabled(oldState.guild.id, "voice_mute", embed);
    } else if (oldState.selfMute && !newState.selfMute) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(t(lang, "voice_unmute"))
        .addFields({ name: t(lang, "user"), value: memberTag })
        .setTimestamp();
      await this.logIfEnabled(oldState.guild.id, "voice_unmute", embed);
    }

    // Deafen/undeafen
    if (!oldState.selfDeaf && newState.selfDeaf) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle(t(lang, "voice_deafen"))
        .addFields({ name: t(lang, "user"), value: memberTag })
        .setTimestamp();
      await this.logIfEnabled(oldState.guild.id, "voice_deafen", embed);
    } else if (oldState.selfDeaf && !newState.selfDeaf) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(t(lang, "voice_undeafen"))
        .addFields({ name: t(lang, "user"), value: memberTag })
        .setTimestamp();
      await this.logIfEnabled(oldState.guild.id, "voice_undeafen", embed);
    }

    // Stream start/stop
    if (!oldState.streaming && newState.streaming) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(t(lang, "voice_stream_start"))
        .addFields({ name: t(lang, "user"), value: memberTag })
        .setTimestamp();
      await this.logIfEnabled(oldState.guild.id, "voice_stream_start", embed);
    } else if (oldState.streaming && !newState.streaming) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle(t(lang, "voice_stream_stop"))
        .addFields({ name: t(lang, "user"), value: memberTag })
        .setTimestamp();
      await this.logIfEnabled(oldState.guild.id, "voice_stream_stop", embed);
    }
  }

  // Role events
  async roleCreated(role: Role) {
    const lang = await this.getGuildLanguage(role.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for role creation:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(t(lang, "role_create"))
      .addFields(
        { name: t(lang, "role"), value: role.name },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(role.guild.id, "role_create", embed);
  }

  async roleDeleted(role: Role) {
    const lang = await this.getGuildLanguage(role.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for role deletion:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(t(lang, "role_delete"))
      .addFields(
        { name: t(lang, "role"), value: role.name },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(role.guild.id, "role_delete", embed);
  }

  async roleUpdated(oldRole: Role, newRole: Role) {
    const lang = await this.getGuildLanguage(newRole.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await newRole.guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for role update:", err);
    }

    if (oldRole.name === newRole.name) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "role_update"))
      .addFields(
        { name: t(lang, "old_role"), value: oldRole.name },
        { name: t(lang, "new_role"), value: newRole.name },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(newRole.guild.id, "role_update", embed);
  }

  // Channel events
  async channelCreated(channel: GuildChannel) {
    const lang = await this.getGuildLanguage(channel.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for channel creation:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(t(lang, "channel_create"))
      .addFields(
        { name: t(lang, "channel"), value: channel.name },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(channel.guild.id, "channel_create", embed);
  }

  async channelDeleted(channel: GuildChannel) {
    const lang = await this.getGuildLanguage(channel.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for channel deletion:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(t(lang, "channel_delete"))
      .addFields(
        { name: t(lang, "channel"), value: channel.name },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(channel.guild.id, "channel_delete", embed);
  }

  async channelUpdated(oldChannel: GuildChannel, newChannel: GuildChannel) {
    const lang = await this.getGuildLanguage(newChannel.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await newChannel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for channel update:", err);
    }

    if (oldChannel.name === newChannel.name) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "channel_update"))
      .addFields(
        { name: t(lang, "old_channel"), value: oldChannel.name },
        { name: t(lang, "new_channel"), value: newChannel.name },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(newChannel.guild.id, "channel_update", embed);
  }

  async channelPinsUpdated(channel: GuildChannel, time: number) {
    const lang = await this.getGuildLanguage(channel.guild.id);
    let user = t(lang, "unknown");

    try {
      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.MessagePin, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for pin:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(t(lang, "channel_pins_update"))
      .addFields(
        { name: t(lang, "channel"), value: channel.name },
        { name: t(lang, "done_by"), value: user },
        { name: t(lang, "time"), value: `<t:${Math.floor(time / 1000)}>` }
      )
      .setTimestamp();

    await this.logIfEnabled(channel.guild.id, "channel_pins_update", embed);
  }
  
  // Thread events
  async threadCreated(thread: ThreadChannel) {
    const lang = await this.getGuildLanguage(thread.guild.id);

    let user = t(lang, "unknown");
    try {
      const logs = await thread.guild.fetchAuditLogs({ type: AuditLogEvent.ThreadCreate, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for thread creation:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(t(lang, "thread_create"))
      .addFields(
        { name: t(lang, "thread"), value: thread.name },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(thread.guild.id, "thread_create", embed);
  }

  async threadDeleted(thread: ThreadChannel) {
    const lang = await this.getGuildLanguage(thread.guild.id);

    let user = t(lang, "unknown");
    try {
      const logs = await thread.guild.fetchAuditLogs({ type: AuditLogEvent.ThreadDelete, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for thread deletion:", err);
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(t(lang, "thread_delete"))
      .addFields(
        { name: t(lang, "thread"), value: thread.name },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(thread.guild.id, "thread_delete", embed);
  }

  async threadUpdated(oldThread: ThreadChannel, newThread: ThreadChannel) {
    const lang = await this.getGuildLanguage(newThread.guild.id);

    let user = t(lang, "unknown");
    try {
      const logs = await newThread.guild.fetchAuditLogs({ type: AuditLogEvent.ThreadUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry) user = `<@${entry.executor?.id}>`;
    } catch (err) {
      console.warn("Failed to fetch audit log for thread update:", err);
    }

    if (oldThread.name === newThread.name) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "thread_update"))
      .addFields(
        { name: t(lang, "old_thread"), value: oldThread.name },
        { name: t(lang, "new_thread"), value: newThread.name },
        { name: t(lang, "done_by"), value: user }
      )
      .setTimestamp();

    await this.logIfEnabled(newThread.guild.id, "thread_update", embed);
  }

  async threadMemberChange(oldMember: any, newMember: any) {
    const thread = newMember.thread || oldMember.thread;
    if (!thread?.guild) return;
    const lang = await this.getGuildLanguage(thread.guild.id);

    let embed: EmbedBuilder;

    if (!oldMember.thread) {
      // Joined thread
      embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(t(lang, "thread_member_join"))
        .addFields(
          { name: t(lang, "user"), value: `<@${newMember.id}>` },
          { name: t(lang, "thread"), value: thread.name }
        )
        .setTimestamp();
      await this.logIfEnabled(thread.guild.id, "thread_member_join", embed);
    } else if (!newMember.thread) {
      // Left thread
      embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle(t(lang, "thread_member_leave"))
        .addFields(
          { name: t(lang, "user"), value: `<@${oldMember.id}>` },
          { name: t(lang, "thread"), value: thread.name }
        )
        .setTimestamp();
      await this.logIfEnabled(thread.guild.id, "thread_member_leave", embed);
    }
  }
  
  // Guild events
  async guildUpdated(oldGuild: any, newGuild: any) {
    const lang = await this.getGuildLanguage(newGuild.id);

    if (oldGuild.name === newGuild.name) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "guild_update"))
      .addFields(
        { name: t(lang, "old_name"), value: oldGuild.name || t(lang, "none") },
        { name: t(lang, "new_name"), value: newGuild.name || t(lang, "none") }
      )
      .setTimestamp();
    await this.logIfEnabled(newGuild.id, "guild_update", embed);
  }

  async guildIntegrationsUpdated(guild: any) {
    const lang = await this.getGuildLanguage(guild.id);
    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "guild_integrations_update"))
      .setDescription(t(lang, "guild_integrations_changed"))
      .setTimestamp();
    await this.logIfEnabled(guild.id, "guild_integrations_update", embed);
  }

  async guildEmojisUpdated(guild: any) {
    const lang = await this.getGuildLanguage(guild.id);
    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "guild_emojis_update"))
      .setDescription(t(lang, "guild_emojis_changed"))
      .setTimestamp();
    await this.logIfEnabled(guild.id, "guild_emojis_update", embed);
  }

  async guildStickersUpdated(guild: any) {
    const lang = await this.getGuildLanguage(guild.id);
    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "guild_stickers_update"))
      .setDescription(t(lang, "guild_stickers_changed"))
      .setTimestamp();
    await this.logIfEnabled(guild.id, "guild_stickers_update", embed);
  }

  // Scheduled events
  async guildScheduledEventCreated(event: GuildScheduledEvent) {
    const lang = await this.getGuildLanguage(event.guildId);
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(t(lang, "guild_scheduled_event_create"))
      .addFields(
        { name: t(lang, "event_name"), value: event.name },
        { name: t(lang, "start_time"), value: `<t:${Math.floor(event.scheduledStartTimestamp / 1000)}:R>` }
      )
      .setTimestamp();
    await this.logIfEnabled(event.guildId, "guild_scheduled_event_create", embed);
  }

  async guildScheduledEventDeleted(event: GuildScheduledEvent) {
    const lang = await this.getGuildLanguage(event.guildId);
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(t(lang, "guild_scheduled_event_delete"))
      .addFields({ name: t(lang, "event_name"), value: event.name })
      .setTimestamp();
    await this.logIfEnabled(event.guildId, "guild_scheduled_event_delete", embed);
  }

  async guildScheduledEventUpdated(oldEvent: GuildScheduledEvent, newEvent: GuildScheduledEvent) {
    const lang = await this.getGuildLanguage(newEvent.guildId);
    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(t(lang, "guild_scheduled_event_update"))
      .addFields(
        { name: t(lang, "old_event_name"), value: oldEvent.name },
        { name: t(lang, "new_event_name"), value: newEvent.name }
      )
      .setTimestamp();
    await this.logIfEnabled(newEvent.guildId, "guild_scheduled_event_update", embed);
  }

  // Bot & Auto Moderation
  async botCommandUsed(interaction: Interaction) {
    if (!interaction.guild) return;
    const lang = await this.getGuildLanguage(interaction.guild.id);

    const user = interaction.user ? `<@${interaction.user.id}>` : t(lang, "unknown");
    const commandName = interaction.isCommand() ? interaction.commandName : t(lang, "unknown");

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(t(lang, "bot_command_used"))
      .addFields(
        { name: t(lang, "user"), value: user },
        { name: t(lang, "command"), value: commandName }
      )
      .setTimestamp();

    await this.logIfEnabled(interaction.guild.id, "bot_command_used", embed);
  }

  async autoModerationTriggered(rule: any) {
    if (!rule.guild) return;
    const lang = await this.getGuildLanguage(rule.guild.id);

    const user = rule.userId ? `<@${rule.userId}>` : t(lang, "unknown");
    const reason = rule.reason || t(lang, "none");

    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle(t(lang, "auto_moderation_trigger"))
      .addFields(
        { name: t(lang, "user"), value: user },
        { name: t(lang, "rule"), value: rule.ruleName || t(lang, "unknown") },
        { name: t(lang, "reason"), value: reason }
      )
      .setTimestamp();

    await this.logIfEnabled(rule.guild.id, "auto_moderation_trigger", embed);
  }
}