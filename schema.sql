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

CREATE TABLE IF NOT EXISTS player_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(100) NOT NULL,
    level_number INT NOT NULL,
    rating INT DEFAULT 5,
    sentiment VARCHAR(50) DEFAULT 'loved_it',
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Default Curated Levels
INSERT INTO puzzles (level_number, title, start_time, target_time, running_duration_minutes, description, difficulty)
VALUES
(1, 'Epoch I: The First Escapement', '01:00', '02:35', 75, 'A simple introduction. The clock runs naturally from 01:00 for 75m to 02:15. You need an extra 20 minutes to reach 02:35.', 'Novice'),
(2, 'Epoch II: Equilibrium of Gears', '12:00', '01:20', 75, 'Natural passage reaches 01:15. A delicate balance is needed (+20m and -15m) to bridge the 5-minute offset to 01:20.', 'Adept'),
(3, 'Epoch III: The Brass Pendulum', '02:00', '04:30', 75, 'Natural run leads to 03:15. You must coordinate multiple time warps to land precisely at 04:30.', 'Master'),
(4, 'Epoch IV: The Temporal Paradox', '06:00', '08:00', 75, 'Coordinate the Inner (Hour) and Outer (Minute) rings in sequence. Timing is everything.', 'Grandmaster'),
(5, 'Epoch V: The Omnipresent Dial', '10:15', '12:00', 75, 'A master trial requiring strategic placement to prevent reverse loops and hit the 12:00 apex.', 'Chronos Supreme'),
(6, 'Epoch VI: Gear-Train Resonance', '03:35', '05:15', 75, 'Natural passage from 03:35 reaches 04:50. Advance the minute hand +25 minutes using fraction warps to synchronize with 05:15.', 'Adept'),
(7, 'Epoch VII: Chrono Dilation', '07:10', '08:15', 75, 'Natural run overshoots to 08:25! Slot negative fraction pins (-1/4 hr = -15m) to decelerate the dial back to 08:15.', 'Expert'),
(8, 'Epoch VIII: The Dual-Arbor Leap', '02:20', '04:30', 75, 'Natural run reaches 03:35. Harness the Inner Hour Ring to trigger an hour leap at Hour 3, then fine-tune minute pins to strike 04:30.', 'Master'),
(9, 'Epoch IX: Celestial Escapement', '08:45', '11:50', 75, 'Bridge the 1 hour 50 minute gap between 10:00 (natural run end) and 11:50 by harmonizing both hour-ring advances and minute warps.', 'Grandmaster'),
(10, 'Epoch X: Grand Chronomancer Trial', '01:00', '04:50', 75, 'The master challenge. Natural run reaches 02:15. Coordinate concentric hour advances and fraction cascades to reach 04:50 before duration expires.', 'Chronos Supreme')
ON DUPLICATE KEY UPDATE title=VALUES(title), start_time=VALUES(start_time), target_time=VALUES(target_time), running_duration_minutes=VALUES(running_duration_minutes), description=VALUES(description), difficulty=VALUES(difficulty);
