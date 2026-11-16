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
    max_pins INT NULL DEFAULT NULL,
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

-- 15 Curated Horological Epochs with Progressive Pin Constraints
INSERT INTO puzzles (level_number, title, start_time, target_time, running_duration_minutes, max_pins, description, difficulty)
VALUES
(1, 'Epoch I: The First Escapement', '01:00', '02:35', 75, NULL, 'Natural passage reaches 02:15. You need an extra 20 minutes to reach 02:35.', 'Novice'),
(2, 'Epoch II: Equilibrium of Gears', '12:00', '01:20', 75, NULL, 'Natural passage reaches 01:15. A delicate balance (+20m and -15m) bridges the 5-minute offset to 01:20.', 'Novice'),
(3, 'Epoch III: The Temporal Paradox', '06:00', '08:00', 75, NULL, 'Coordinate concentric rings to bridge a 45-minute offset from 07:15 natural run end to 08:00.', 'Apprentice'),
(4, 'Epoch IV: Synchronized Arbors', '07:00', '08:15', 75, NULL, 'Natural 75m passage synchronizes directly with 08:15. Maintain balance across sweeps.', 'Apprentice'),
(5, 'Epoch V: Gear-Train Resonance', '03:35', '05:15', 75, NULL, 'Natural passage reaches 04:50. Advance the minute hand +25 minutes to strike 05:15.', 'Adept'),
(6, 'Epoch VI: Chrono Dilation', '07:10', '08:15', 75, NULL, 'Natural passage overshoots to 08:25! Slot negative fraction warps to decelerate the dial back to 08:15.', 'Adept'),
(7, 'Epoch VII: The Omnipresent Dial', '10:15', '12:00', 75, 3, 'Natural passage reaches 11:30. Bridge the 30-minute gap to 12:00 using no more than 3 fraction pins.', 'Expert'),
(8, 'Epoch VIII: The Brass Pendulum', '02:00', '04:30', 75, 4, 'Natural run reaches 03:15. Harness hour step advances and minute sweeps with a strict 4-pin budget.', 'Expert'),
(9, 'Epoch IX: Dual Escapement Cadence', '01:30', '03:15', 75, 2, 'Natural run reaches 02:45. Advance +30 minutes to reach 03:15 using at most 2 pins!', 'Master'),
(10, 'Epoch X: The Dual-Arbor Leap', '02:20', '04:30', 75, 5, 'Natural run reaches 03:35. Coordinate inner and outer triggers to bridge a 55-minute gap with max 5 pins.', 'Master'),
(11, 'Epoch XI: Harmonic Oscillations', '04:45', '06:45', 75, 4, 'Natural run reaches 06:00. Advance 45 minutes to synchronize with 06:45 using 4 pins max.', 'Grandmaster'),
(12, 'Epoch XII: The Monolithic Leap', '06:25', '08:00', 75, 1, 'Natural run reaches 07:40. You need exactly +20m to reach 08:00 — achieve this with ONLY 1 pin!', 'Grandmaster'),
(13, 'Epoch XIII: Chrono Convergence', '02:00', '04:10', 75, 5, 'Natural run reaches 03:15. Complex 55-minute coordination under a 5-pin budget.', 'Chronos Supreme'),
(14, 'Epoch XIV: Concentric Resonance', '05:20', '07:00', 75, 3, 'Natural run reaches 06:35. Bridge the 25-minute offset to 07:00 with at most 3 pins.', 'Chronos Supreme'),
(15, 'Epoch XV: Grand Chronomancer Apex', '03:25', '05:05', 75, 4, 'The pinnacle trial. Natural run reaches 04:40. Reach 05:05 within a strict 4-pin constraint!', 'Chronos Supreme')
ON DUPLICATE KEY UPDATE 
    title=VALUES(title), 
    start_time=VALUES(start_time), 
    target_time=VALUES(target_time), 
    running_duration_minutes=VALUES(running_duration_minutes),
    max_pins=VALUES(max_pins),
    description=VALUES(description), 
    difficulty=VALUES(difficulty);
