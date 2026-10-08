# ❄️ Winter Arc - LeetCode Tracker

Winter Arc is a beautiful, AI-powered leaderboard and tracking dashboard for a 90-day LeetCode challenge (Oct 1 - Dec 31). It tracks daily submissions, scores code quality using a custom AI pipeline (LangGraph + Ollama), and visualizes progress in a highly competitive, aesthetic dashboard.

## 🌟 Features

- **Dynamic Leaderboard**: Ranks users based on an AI-generated score out of 10.0.
  - **Medals**: Dynamic rendering of Gold 🥇, Silver 🥈, and Bronze 🥉 text gradients based on competitive ranking (ties share the same rank).
- **AI Code Analysis**:
  - Automatically fetches the submitted code and runs it through a local LLM via Ollama.
  - **Efficiency Score** (40%): Evaluates time and space complexity based on constraints.
  - **Quality Score** (20%): Evaluates best practices, modularity, and error handling.
  - **Correctness Score** (15%): Assesses edge cases and algorithmic soundness.
  - Generates a **Code Review** and classifies the specific **DSA Approach** using a robust hierarchical mapping (`hierarchy.json`).
- **Winter Arc Progress Tracker**: A 92-day GitHub-style contribution graph for each user to track consistency (Green for submitted, Red for missed).
- **Topic Coverage Badges**: Extracts unique algorithmic topics learned by each user (e.g. `Sliding Window`, `Monotonic Stack`) from the AI analysis and displays them as badges.
- **Code Viewer**: Click on any user in the leaderboard to instantly view their raw submitted code in a clean modal.

## 🛠️ Tech Stack

### Frontend
- Next.js (React)
- Tailwind CSS (Custom themes, gradients, and micro-animations)
- Framer Motion (Smooth layout and enter animations)
- Lucide React (Icons)

### Backend
- Express.js (TypeScript)
- Firebase Admin SDK (Firestore Database)
- LangChain / LangGraph (Orchestrating the AI evaluation pipeline)
- Ollama (Local LLM backend)
- Axios & Cheerio (LeetCode API interactions)

---

## 🚀 Getting Started

### 1. Prerequisites
- Docker and Docker Compose installed
- Firebase Admin Service Account Key JSON
- LeetCode Session tokens (if required for private code fetching)
- [Ollama](https://ollama.com/) running locally (ensure `http://localhost:11434` is reachable)

### 2. Environment Variables
You need to set up the environment variables. The backend requires a `.env` file containing:
- `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string)
- `OLLAMA_BASE_URL` (Use `http://host.docker.internal:11434` for Docker)
- `LEETCODE_SESSION` & `LEETCODE_CSRF_TOKEN`

### 3. Run the Application
Start the frontend and backend simultaneously using Docker Compose:

```bash
docker compose up
```

The frontend will be available at `http://localhost:3000`.

---

## 🤖 Running the AI Data Pipeline

The backend includes several scripts to sync data from LeetCode and run the AI analysis. **You can run these scripts directly inside your running backend Docker container** using `docker compose exec`.

In a **new terminal tab** (while `docker compose up` is running), execute the following:

### 1. Seed Recent Submissions
Scans the public LeetCode profiles of the participants and fetches their latest accepted submissions into Firestore.
```bash
docker compose exec backend npm run seed
```

### 2. Download Source Codes
Authenticates with LeetCode to download the actual source code strings and the problem statements for the fetched submissions.
```bash
docker compose exec backend npm run fetch
```

### 3. Run the AI Evaluator
Feeds the newly downloaded source code into the LangGraph AI pipeline. It scores the code, generates a review, maps the algorithmic approach, and saves the final stats back to Firestore.
```bash
docker compose exec backend npm run analyze
```
*(Ensure the Ollama application is actively running on your host machine before running this!)*

---

## 🗑️ Database Reset

If you ever need to completely wipe the dashboard clean (e.g., to restart the arc or clear buggy data), you can run the deletion script. This will delete all `submissions` and `analyses` documents from Firestore.

```bash
docker compose exec backend npx tsx src/scripts/deleteAllData.ts
```
