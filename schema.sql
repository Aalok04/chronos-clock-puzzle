-- CHRONOS: Time Manipulation Clock Puzzle
-- MySQL Database Schema for Free Cloud Database Hosting (TiDB Cloud / Aiven / Localhost)

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student',
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INT PRIMARY KEY,
    rank_title VARCHAR(50) DEFAULT 'Apprentice Chronomancer',
    puzzles_solved INT DEFAULT 0,
    current_level INT DEFAULT 1,
    unlocked_level INT DEFAULT 1,
    completed_levels JSON NULL,
    achievements JSON NULL,
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
(6, 'Epoch VI: Dual-Ring Harmony', '02:00', '05:00', 75, 2, 'Natural passage reaches 03:15. Coordinate both concentric rings (+2h Hour Hand, -15m Minute Hand) with a 2-pin budget to strike 05:00.', 'Adept'),
(7, 'Epoch VII: Concentric Cross-Sweep', '08:00', '01:00', 75, 2, 'Natural passage reaches 09:15. Advance the hour step (+4h) and calibrate the minute sweep (-15m) within 2 pins to synchronize with 01:00.', 'Expert'),
(8, 'Epoch VIII: Counter-Clock Cadence', '11:00', '09:35', 75, 2, 'Natural run reaches 12:15. Apply hour deceleration (-3h) and advance minute travel (+20m) using max 2 pins to strike 09:35.', 'Expert'),
(9, 'Epoch IX: Triad Escapement', '10:00', '02:45', 75, 3, 'Natural run reaches 11:15. Coordinate an hour warp (+4h) with dual decelerations (-30m) across both rings using at most 3 pins to lock at 02:45.', 'Master'),
(10, 'Epoch X: Dual-Arbor Leap', '05:00', '02:35', 75, 3, 'Natural run reaches 06:15. Double up inner ring advances (+8h) and coordinate the minute sweep (+20m) within a strict 3-pin limit to reach 02:35.', 'Master'),
(11, 'Epoch XI: Harmonic Bifurcation', '09:00', '04:55', 75, 4, 'Natural run reaches 10:15. Multiple paths exist! Advance minutes (+40m) and coordinate hour shifts to achieve 04:55 using at most 4 pins.', 'Grandmaster'),
(12, 'Epoch XII: Quadrant Equilibrium', '07:00', '03:45', 75, 4, 'Natural run reaches 08:15. Coordinate dual inner advances (+8h) with dual minute decelerations (-30m) under a 4-pin constraint to strike 03:45.', 'Grandmaster'),
(13, 'Epoch XIII: Chrono Resonance Convergence', '04:00', '08:35', 75, 4, 'Natural run reaches 05:15. Multi-pin concentration on the inner ring paired with minute pacing to bridge the temporal gap to 08:35 with 4 pins.', 'Chronos Supreme'),
(14, 'Epoch XIV: Multi-Phase Dial Synchrony', '10:00', '04:10', 75, 5, 'Natural run reaches 11:15. Complex 5-pin coordination across mixed colors and directions on both rings to align the dial at 04:10.', 'Chronos Supreme'),
(15, 'Epoch XV: Grand Chronomancer Apex', '06:00', '06:05', 75, 5, 'The pinnacle trial. Natural run reaches 07:15. Master mixed color fractions and counter-sweeps on both rings within 5 pins to strike 06:05.', 'Chronos Supreme')
ON DUPLICATE KEY UPDATE 
    title=VALUES(title), 
    start_time=VALUES(start_time), 
    target_time=VALUES(target_time), 
    running_duration_minutes=VALUES(running_duration_minutes),
    max_pins=VALUES(max_pins),
    description=VALUES(description), 
    difficulty=VALUES(difficulty);
