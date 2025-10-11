CREATE TABLE discord_messages (
    guild_id String,
    channel_id String,
    user_id String,
    message_id String,
    is_command UInt8,
    command_name String DEFAULT '',
    created_at DateTime
) ENGINE = MergeTree()
ORDER BY (guild_id, created_at);

CREATE TABLE discord_membership (
    guild_id String,
    user_id String,
    joined_at DateTime,
    left_at DateTime DEFAULT NULL
) ENGINE = MergeTree()
    ORDER BY (guild_id, joined_at);

CREATE TABLE discord_commands (
    guild_id String,
    user_id String,
    command_name String,
    executed_at DateTime
) ENGINE = MergeTree()
    ORDER BY (guild_id, executed_at);