CREATE TABLE IF NOT EXISTS `bumpreminder_settings` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `guild_id` VARCHAR(22) NOT NULL,
    `channel` VARCHAR(22) NOT NULL,
    `message` TEXT NOT NULL,
    `interval` INT NOT NULL,
    'enabled' INT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
