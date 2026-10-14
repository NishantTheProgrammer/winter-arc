# Winter Arc - macOS Native Task Scheduler

Native macOS hourly background scheduler for Winter Arc using `launchd`, `caffeinate`, and `pmset`.

Executes every hour:
1. `docker compose exec backend npm run pick:sd`
2. `docker compose exec backend npm run sync` (runs only after `pick:sd` finishes)

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │ macOS Hardware Clock (pmset schedule wake)   │
                      └──────────────────────┬───────────────────────┘
                                             │ Wakes Mac at :00 (if sleeping)
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ macOS launchd                                                                          │
│                                                                                        │
│  ├─ System Domain (root): com.winterarc.wakescheduler                                 │
│  │    └─ Replenishes rolling 24-hour wake queue in pmset                               │
│  │                                                                                     │
│  └─ User Aqua Domain: com.winterarc.hourlysync                                         │
│       └─ Runs: macos-scheduler/run_tasks.sh                                            │
│            │                                                                           │
│            ├─ 1. Wraps in `caffeinate -ims` (keeps Mac awake during execution)         │
│            ├─ 2. Acquires atomic PID lock (prevents overlapping runs)                  │
│            ├─ 3. Switches to configured project directory                              │
│            ├─ 4. Verifies Docker daemon & backend container                            │
│            ├─ 5. Executes `docker compose exec -T backend npm run pick:sd`             │
│            ├─ 6. Executes `docker compose exec -T backend npm run sync` (after #5)     │
│            ├─ 7. Appends timestamped stdout & stderr to `logs/scheduler.log`           │
│            ├─ 8. Cleans up lockfile                                                    │
│            └─ 9. Exits `caffeinate` -> Mac returns to sleep if idle / lid closed       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Features & Requirements Met

| Requirement | Implementation Detail |
| :--- | :--- |
| **Run every hour** | `launchd` `StartCalendarInterval` set to minute `0` of every hour. |
| **Project directory** | `cd "$PROJECT_DIR"` executed before any Docker command. Fully configurable. |
| **Awake Mac** | Runs silently in the background under user LaunchAgent. |
| **Sleeping / Lid Closed** | `pmset schedule wake` wakes the Mac at the top of the hour. `caffeinate -ims` prevents sleep during execution, then allows sleep again once finished. |
| **No continuous wake** | `caffeinate` assertions exist *only* while tasks are actively executing. |
| **Native macOS tools** | Zero third-party daemon dependencies; uses `launchd`, `pmset`, and `caffeinate`. |
| **Execution order** | `pick:sd` runs first; `sync` runs second only after `pick:sd` completes. |
| **Captured logs** | Output captured with timestamps into `macos-scheduler/logs/scheduler.log`. |
| **Prevent overlap** | Atomic `set -o noclobber` PID lockfile with automatic stale lock recovery. |
| **Configurable directory** | Set via `PROJECT_DIR` in `config.sh`, env variable, or passed to `./manage.sh setup <path>`. |
| **Simple commands** | Single `manage.sh` CLI for setup, start, stop, status, run-now, logs, uninstall. |
| **Zero project modifications**| No files in `backend/`, `frontend/`, or `docker-compose.yml` are modified. |

---

## Usage Commands

All management actions are performed through `./macos-scheduler/manage.sh`:

### 1. Setup & Activate
```bash
./macos-scheduler/manage.sh setup
```
*Tip: To use a custom project directory:*
```bash
./macos-scheduler/manage.sh setup /path/to/winter-arc
```
*(Setup configures the user LaunchAgent and will prompt for `sudo` to configure the `pmset` wake schedule and root helper daemon).*

### 2. Check Status
```bash
./macos-scheduler/manage.sh status
```
Displays:
- User LaunchAgent status (Loaded / Active PID)
- System WakeDaemon status
- Overlap lock status
- Docker container health
- Upcoming scheduled `pmset` wake times
- Last lines of the execution log

### 3. Test Run Immediately
```bash
./macos-scheduler/manage.sh run-now
```
Runs the full pipeline in foreground with live terminal output and logging to verify behavior without waiting for the top of the hour.

### 4. View Live Logs
```bash
./macos-scheduler/manage.sh logs
```
Tails `logs/scheduler.log`.

### 5. Pause / Stop
```bash
./macos-scheduler/manage.sh stop
```
Unloads the LaunchAgent and cancels upcoming scheduled wake events.

### 6. Start / Resume
```bash
./macos-scheduler/manage.sh start
```

### 7. Complete Uninstall
```bash
./macos-scheduler/manage.sh uninstall
```
Unloads all agents and daemons, removes `.plist` files, cancels all pmset wake events, and removes lockfiles.

---

## Sleeping & Closed-Lid Notes

When a MacBook lid is closed:
1. **Power Adapter (AC Charger):** Keeping the MacBook connected to power ensures reliable RTC hardware wakeups and allows Power Nap / background wake tasks to execute smoothly.
2. **On Battery:** macOS power management aggressively conserves battery with the lid shut. For optimal reliability when sleeping with the lid closed, connect the charger.
