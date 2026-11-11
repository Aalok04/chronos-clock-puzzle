# CHRONOS: Time Manipulation Clock Puzzle
> **Academic Capstone Project** — Interactive Horological Puzzle Game with User Authentication & Free Cloud MySQL Database Persistence.

---

## 🕒 Overview
**CHRONOS** is an interactive mathematical puzzle game where players manipulate a working analogue mechanical clock to reach an exact **Target Time** before a fixed **Running Duration** (default 75 minutes) elapses. Players position 9 special time-warping pins into 24 concentric sockets on the clock face to alter the hands' physical movement.

- **Outer Socket Circle (12 holes):** Positioned along the minute track at 5-minute ticks (triggered by the **Minute Hand**).
- **Inner Socket Circle (12 holes):** Positioned in front of the Roman numerals (triggered by the **Hour Hand**).
- **Dual-Time Invariance:** Activating a pin adjusts the clock time (+20m, -15m, +10m) without consuming or altering the remaining running duration budget.
- **Automated Rewind Reset:** On an unsuccessful attempt, the clock reverse-rotates backwards to the start time and pins glide back to the inventory tray.

---

## 🎨 UI & Aesthetics (Designed via Google Stitch AI)
- **Design System:** *Horological Tactile Luxury* (Stitch Project `9190389816738533371`).
- **Materials:** Milled dark obsidian decks, brushed slate movement plates, antique brass bezels, and luminous aether gems.
- **Audio:** Native Web Audio API procedural synthesizer (mechanical escapement ticks, metallic pin clicks, harmonic chimes, and rewind whirl).

---

## 🗄️ Database Schema & Free Cloud MySQL

The project uses standard **MySQL 8**. It is preconfigured to connect to **TiDB Cloud Serverless** (5GB free forever, no credit card required) or any MySQL database.

### Database Tables:
1. `users` — Stores student handles, emails, role, and bcrypt-hashed passkeys.
2. `user_profiles` — Tracks puzzles solved, current level progress, and earned chronomancer ranks.
3. `puzzles` — Stores calibrated epochs with starting times, target times, and descriptions.
4. `game_attempts` — Telemetry archive storing placed pin configurations and attempt outcomes.

---

## 🚀 Quick Start (Local Run)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=chronos_horology_super_secret_jwt_passkey_2024

# MySQL Settings (Defaults to local or in-memory fallback if MySQL is offline)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=chronos_clock_db
DB_SSL=false
```

### 3. Start Server
```bash
npm start
# or development with auto-reload:
npm run dev
```

Open your browser at **`http://localhost:3000`**.

> **Note on Offline / Resilient Execution:** If you run the project without MySQL running, the engine automatically switches to **Resilient In-Memory Mode**. All features, authentication, level advancement, and pin dragging remain 100% playable for vivas and demos!

---

## ☁️ How to Connect Free Cloud MySQL (TiDB Cloud)

1. Go to **[https://tidbcloud.com](https://tidbcloud.com)** and sign up for free (Google / GitHub login, no credit card required).
2. Click **Create Cluster** and select **Serverless** (Free 5GB Forever).
3. Once created, click **Connect**:
   - Choose **Endpoint Type: Public**
   - Choose **Connect with: Node.js / MySQL**
4. Copy your credentials into your `.env` file:
   ```env
   DB_HOST=gateway01.us-east-1.prod.aws.tidbcloud.com
   DB_PORT=4000
   DB_USER=your_username.root
   DB_PASSWORD=your_password
   DB_NAME=chronos_clock_db
   DB_SSL=true
   ```
5. Restart your server (`npm start`). The server will automatically execute `schema.sql`, create the tables, and seed the default levels!

---

## 🌐 Deploy to Free Server (Render.com)

1. Push this project folder to your GitHub repository.
2. Sign up at **[Render.com](https://render.com)** (Free).
3. Click **New +** $\rightarrow$ **Web Service**.
4. Connect your GitHub repository.
5. Set:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. In **Environment Variables**, add the variables from your `.env` (including your TiDB Cloud credentials).
7. Click **Deploy Web Service**! You will receive a live URL: `https://your-clock-puzzle.onrender.com`.

---

## 🎓 College Viva & Evaluation Notes

- **Q: How does the clock prevent infinite loops when a backward pin (-15m) moves the hand back?**
  *A:* Each placed pin has an internal `hasTriggered` boolean flag per run. Once activated, the pin is marked as spent and will not re-trigger during that run.

- **Q: How is the running duration kept independent from pin jumps?**
  *A:* The engine uses a dual-time tracking accumulator. `displayedTime` drives the visual hands and receives pin jumps, while `elapsedRunningDuration` strictly records normal forward elapsed time (0 to 75m) and pauses completely during pin activation sequences.

- **Q: How is user security implemented?**
  *A:* Passwords are never stored in plaintext; they are hashed using `bcryptjs` with salt rounds. Sessions are verified using JSON Web Tokens (JWT) signed with HMAC-SHA256.
