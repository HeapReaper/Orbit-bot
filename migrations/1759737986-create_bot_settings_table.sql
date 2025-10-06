CREATE TABLE IF NOT EXISTS `bot_settings` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `guild_id` VARCHAR(22) NOT NULL UNIQUE,
    `nickname` VARCHAR(50) DEFAULT NULL,
    `manager_roles` TEXT DEFAULT NULL,
    `updates_channel` VARCHAR(22) DEFAULT NULL,
    `timezone` VARCHAR(22) DEFAULT NULL,
    `primary_color` VARCHAR(22) DEFAULT NULL,
    `secondary_color` VARCHAR(22) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;