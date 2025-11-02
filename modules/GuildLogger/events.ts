import {
  Client,
  Events as DiscordEvents,
  Message,
  GuildMember,
  Role,
  VoiceState,
  ThreadChannel,
  Channel,
  GuildScheduledEvent,
  CommandInteraction,
  Interaction,
} from "discord.js";

let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    // Message Events
    this.client.on(DiscordEvents.MessageDelete, (message) => this.messageDelete(message));
    this.client.on(DiscordEvents.MessageBulkDelete, (messages) => this.messagesBulkDelete(messages));
    this.client.on(DiscordEvents.MessageUpdate, (oldMessage, newMessage) => this.messageUpdate(oldMessage, newMessage));
    this.client.on(DiscordEvents.MessageReactionAdd, (reaction, user) => this.reactionAdd(reaction, user));
    this.client.on(DiscordEvents.MessageReactionRemove, (reaction, user) => this.reactionRemove(reaction, user));
    this.client.on(DiscordEvents.MessageReactionRemoveAll, (message) => this.reactionsCleared(message));

    // Member Events
    this.client.on(DiscordEvents.GuildMemberAdd, (member) => this.memberJoined(member));
    this.client.on(DiscordEvents.GuildMemberRemove, (member) => this.memberLeft(member));
    this.client.on(DiscordEvents.GuildMemberUpdate, (oldMember, newMember) => this.memberUpdated(oldMember, newMember));
    this.client.on(DiscordEvents.GuildBanAdd, (ban) => this.memberBanned(ban));
    this.client.on(DiscordEvents.GuildBanRemove, (ban) => this.memberUnbanned(ban));

    // Voice Events
    this.client.on(DiscordEvents.VoiceStateUpdate, (oldState, newState) => this.voiceStateUpdate(oldState, newState));

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
    this.client.on(DiscordEvents.ThreadMembersUpdate, (oldMembers, newMembers) => this.threadMembersUpdated(oldMembers, newMembers));

    // Guild Events
    this.client.on(DiscordEvents.GuildUpdate, (oldGuild, newGuild) => this.serverSettingsUpdated(oldGuild, newGuild));
    this.client.on(DiscordEvents.GuildIntegrationsUpdate, (guild) => this.integrationsUpdated(guild));
    this.client.on(DiscordEvents.GuildEmojisUpdate, (guild, oldEmojis, newEmojis) => this.emojisUpdated(guild, oldEmojis, newEmojis));
    this.client.on(DiscordEvents.GuildStickersUpdate, (guild, oldStickers, newStickers) => this.stickersUpdated(guild, oldStickers, newStickers));

    // Scheduled Events
    this.client.on(DiscordEvents.GuildScheduledEventCreate, (event) => this.scheduledEventCreated(event));
    this.client.on(DiscordEvents.GuildScheduledEventDelete, (event) => this.scheduledEventDeleted(event));
    this.client.on(DiscordEvents.GuildScheduledEventUpdate, (oldEvent, newEvent) => this.scheduledEventUpdated(oldEvent, newEvent));

    // Commands & Auto mod
    this.client.on(DiscordEvents.InteractionCreate, (interaction) => this.interactionCreate(interaction));
    this.client.on(DiscordEvents.AutoModerationActionExecution, (execution) => this.automodTriggered(execution));

    // Custom / Miscellaneous
  }

  // Message Events
  async messageDelete(message: Message) {
    //
  }

  async messagesBulkDelete(messages: any) {
    //
  }

  async messageUpdate(oldMessage: Message, newMessage: Message) {
    //
  }

  async reactionAdd(reaction, user) {
    //
  }

  async reactionRemove(reaction, user) {
    //
  }

  async reactionsCleared(message: Message) {
    //
  }

  // Member Events
  async memberJoined(member: GuildMember) {
    //
  }

  async memberLeft(member: GuildMember) {
    //
  }

  async memberUpdated(oldMember: GuildMember, newMember: GuildMember) {
    //
  }

  async memberBanned(ban) {
    //
  }

  async memberUnbanned(ban) {
    //
  }

  // Voice Events
  async voiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    if (!oldState.channel && newState.channel) return this.joinedVoiceChannel(newState);
    if (oldState.channel && !newState.channel) return this.leftVoiceChannel(oldState);
    if (oldState.channelId !== newState.channelId) return this.switchedVoiceChannel(oldState, newState);
    if (oldState.serverMute !== newState.serverMute) return this.serverMuteChanged(newState);
    if (oldState.serverDeaf !== newState.serverDeaf) return this.serverDeafChanged(newState);
  }

  async joinedVoiceChannel(state: VoiceState) {
    //
  }

  async leftVoiceChannel(state: VoiceState) {
    //
  }

  async switchedVoiceChannel(oldState: VoiceState, newState: VoiceState) {
    //
  }

  async serverMuteChanged(state: VoiceState) {
    //
  }

  async serverDeafChanged(state: VoiceState) {
    //
  }

  // Role Events
  async roleCreated(role: Role) {
    //
  }

  async roleDeleted(role: Role) {
    //
  }

  async roleUpdated(oldRole: Role, newRole: Role) {
    //
  }

  // Channel Events
  async channelCreated(channel: Channel) {
    //
  }

  async channelDeleted(channel: Channel) {
    //
  }

  async channelUpdated(oldChannel: Channel, newChannel: Channel) {
    //
  }

  async channelPinsUpdated(channel: Channel, time: Date) {
    //
  }

  // Thread Events
  async threadCreated(thread: ThreadChannel) {
    //
  }

  async threadDeleted(thread: ThreadChannel) {
    //
  }

  async threadUpdated(oldThread: ThreadChannel, newThread: ThreadChannel) {
    //
  }

  async threadMembersUpdated(oldMembers, newMembers) {
    //
  }

  // Server Events
  async serverSettingsUpdated(oldGuild, newGuild) {
    //
  }

  async integrationsUpdated(guild) {
    //
  }

  async emojisUpdated(guild, oldEmojis, newEmojis) {
    //
  }

  async stickersUpdated(guild, oldStickers, newStickers) {
    //
  }

  // Scheduled events
  async scheduledEventCreated(event: GuildScheduledEvent) {
    //
  }

  async scheduledEventDeleted(event: GuildScheduledEvent) {
    //
  }

  async scheduledEventUpdated(oldEvent: GuildScheduledEvent, newEvent: GuildScheduledEvent) {
    //
  }

  // Interaction / Command / AutoMod
  async interactionCreate(interaction: Interaction) {
    if (interaction.isCommand()) return this.botCommandUsed(interaction);
  }
  async botCommandUsed(interaction: CommandInteraction) {
    //
  }
  async automodTriggered(execution) {
    //
  }

  // Custom / Misc
  async giveawayStarted(giveaway) {
    //
  }

  async giveawayEnded(giveaway) {
    //
  }

  async birthdayMessageSent(user) {
    //
  }
}
