-- CHRONOS: Time Manipulation Clock Puzzle
-- MySQL Database Schema for Free Cloud Database Hosting (TiDB Cloud / Aiven / Localhost)

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INT PRIMARY KEY,
    rank_title VARCHAR(50) DEFAULT 'Apprentice Chronomancer',
    puzzles_solved INT DEFAULT 0,
    current_level INT DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS puzzles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    level_number INT NOT NULL UNIQUE,
    title VARCHAR(100) NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    target_time VARCHAR(10) NOT NULL,
    running_duration_minutes INT NOT NULL DEFAULT 75,
    description TEXT,
    difficulty VARCHAR(20) DEFAULT 'Medium'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    puzzle_id INT,
    pins_configuration JSON,
    final_displayed_time VARCHAR(10),
    is_success BOOLEAN NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (puzzle_id) REFERENCES puzzles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Default Curated Levels
INSERT INTO puzzles (level_number, title, start_time, target_time, running_duration_minutes, description, difficulty)
VALUES
(1, 'Epoch I: The First Escapement', '01:00', '02:35', 75, 'A simple introduction. The clock runs naturally from 01:00 for 75m to 02:15. You need an extra 20 minutes to reach 02:35.', 'Novice'),
(2, 'Epoch II: Equilibrium of Gears', '12:00', '01:20', 75, 'Natural passage reaches 01:15. A delicate balance is needed (+20m and -15m) to bridge the 5-minute offset to 01:20.', 'Adept'),
(3, 'Epoch III: The Brass Pendulum', '02:00', '04:30', 75, 'Natural run leads to 03:15. You must coordinate multiple time warps to land precisely at 04:30.', 'Master'),
(4, 'Epoch IV: The Temporal Paradox', '06:00', '08:00', 75, 'Coordinate the Inner (Hour) and Outer (Minute) rings in sequence. Timing is everything.', 'Grandmaster'),
(5, 'Epoch V: The Omnipresent Dial', '10:15', '12:00', 75, 'A master trial requiring strategic placement to prevent reverse loops and hit the 12:00 apex.', 'Chronos Supreme')
ON DUPLICATE KEY UPDATE title=VALUES(title), start_time=VALUES(start_time), target_time=VALUES(target_time);
