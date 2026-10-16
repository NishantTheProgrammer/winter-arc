#!/usr/bin/env bash
# ==============================================================================
# Winter Arc - Hourly Task Runner
# Executes:
#   1. docker compose exec -T backend npm run pick:sd
#   2. docker compose exec -T backend npm run sync
# Features:
#   - Prevents overlapping runs (atomic PID lockfile)
#   - Wraps execution in caffeinate -ims to prevent sleep during run
#   - Releases sleep assertions immediately upon completion
#   - Captures stdout/stderr with timestamps into log file
# ==============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.sh"

if [ -f "$CONFIG_FILE" ]; then
    # shellcheck source=config.sh
    source "$CONFIG_FILE"
else
    echo "ERROR: Configuration file not found at $CONFIG_FILE" >&2
    exit 1
fi

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# ------------------------------------------------------------------------------
# 1. Caffeinate Self-Wrapper
# Prevents system and disk idle sleep while script is running,
# but terminates immediately when script finishes, allowing Mac to sleep again.
# ------------------------------------------------------------------------------
if [ -z "${WINTER_ARC_CAFFEINATED:-}" ]; then
    export WINTER_ARC_CAFFEINATED=1
    exec "$CAFFEINATE_BIN" -uims "$0" "$@"
fi

# ------------------------------------------------------------------------------
# 2. Redirect all output to log file as well as terminal
# ------------------------------------------------------------------------------
exec >> >(tee -a "$LOG_FILE") 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# ------------------------------------------------------------------------------
# 3. Lockfile & Clamshell Power Management
# ------------------------------------------------------------------------------
WATCHDOG_PID=""
DISABLESLEEP_ENGAGED=0

enable_clamshell_execution() {
    # If on battery power, temporarily suspend sleep so closed lid does not freeze task
    local batt_status
    batt_status="$("$PMSET_BIN" -g batt 2>/dev/null || echo '')"
    if [[ "$batt_status" == *"Battery Power"* ]]; then
        if sudo -n "$PMSET_BIN" -a disablesleep 1 >/dev/null 2>&1; then
            DISABLESLEEP_ENGAGED=1
            log "⚡ Clamshell battery execution active (sleep temporarily held for this run)."
            
            # Watchdog: Force restore sleep mode after 15 minutes if something catastrophic occurs
            (
                sleep 900
                sudo -n "$PMSET_BIN" -a disablesleep 0 >/dev/null 2>&1 || true
            ) &
            WATCHDOG_PID=$!
        else
            log "NOTE: Mac is on Battery Power. (Tip: run './manage.sh setup' once to enable seamless closed-lid execution)."
        fi
    fi
}

cleanup() {
    # 1. Kill safety watchdog if still running
    if [ -n "$WATCHDOG_PID" ] && kill -0 "$WATCHDOG_PID" 2>/dev/null; then
        kill "$WATCHDOG_PID" 2>/dev/null || true
    fi

    # 2. Re-enable normal sleep mode immediately
    if [ "$DISABLESLEEP_ENGAGED" -eq 1 ]; then
        sudo -n "$PMSET_BIN" -a disablesleep 0 >/dev/null 2>&1 || true
        log "🌙 Re-enabled normal sleep mode. Mac may now sleep if lid is closed."
    fi

    # 3. Release lockfile
    rm -f "$LOCK_FILE"
}

acquire_lock() {
    if ( set -o noclobber; echo "$$" > "$LOCK_FILE" ) 2>/dev/null; then
        # Lock acquired
        trap 'cleanup' EXIT INT TERM
        enable_clamshell_execution
        return 0
    else
        # Lock exists, verify if process is still alive
        local active_pid
        active_pid="$(cat "$LOCK_FILE" 2>/dev/null || echo "")"
        if [ -n "$active_pid" ] && kill -0 "$active_pid" 2>/dev/null; then
            log "SKIP: Previous execution (PID: $active_pid) is still active. Skipping this cycle to prevent overlap."
            exit 0
        else
            log "Stale lock detected (PID: $active_pid is not running). Reclaiming lock."
            echo "$$" > "$LOCK_FILE"
            trap 'cleanup' EXIT INT TERM
            enable_clamshell_execution
            return 0
        fi
    fi
}

acquire_lock

# ------------------------------------------------------------------------------
# 4. Helper: Run with Timeout (prevents hanging indefinitely if connection drops)
# ------------------------------------------------------------------------------
run_with_timeout() {
    local max_seconds="$1"
    shift
    "$@" &
    local cmd_pid=$!

    (
        sleep "$max_seconds"
        if kill -0 "$cmd_pid" 2>/dev/null; then
            kill -TERM "$cmd_pid" 2>/dev/null || true
            sleep 3
            kill -KILL "$cmd_pid" 2>/dev/null || true
        fi
    ) &
    local watchdog_pid=$!

    wait "$cmd_pid"
    local status=$?
    kill "$watchdog_pid" 2>/dev/null || true
    wait "$watchdog_pid" 2>/dev/null || true
    return "$status"
}

# ------------------------------------------------------------------------------
# 5. Task Execution
# ------------------------------------------------------------------------------
START_TIME=$(date +%s)
log "================================================================================"
log "Starting Winter Arc Hourly Task Execution (PID: $$)"
log "Project Directory: $PROJECT_DIR"
log "Power State: $("$PMSET_BIN" -g batt 2>/dev/null | grep -oE "'.*'" || echo 'Unknown')"
log "================================================================================"

# Change to project root directory
if ! cd "$PROJECT_DIR"; then
    log "ERROR: Could not switch to project directory: $PROJECT_DIR"
    exit 1
fi

# Verify Docker availability (wait up to 30s if waking up from sleep)
DOCKER_READY=false
for i in {1..6}; do
    if "$DOCKER_BIN" info >/dev/null 2>&1; then
        DOCKER_READY=true
        break
    fi
    log "Waiting for Docker daemon to become responsive (attempt $i/6)..."
    sleep 5
done

if [ "$DOCKER_READY" != "true" ]; then
    log "ERROR: Docker daemon is unreachable. Skipping this run."
    exit 1
fi

# Verify network connectivity (wait up to 15s if Wi-Fi just woke up)
NETWORK_READY=false
for i in {1..5}; do
    if nc -zw 2 1.1.1.1 53 >/dev/null 2>&1 || nc -zw 2 8.8.8.8 53 >/dev/null 2>&1; then
        NETWORK_READY=true
        break
    fi
    log "Waiting for network connectivity to restore (attempt $i/5)..."
    sleep 3
done

if [ "$NETWORK_READY" != "true" ]; then
    log "WARNING: Network connectivity test failed. Proceeding with caution..."
fi

# Check backend container state
CONTAINER_STATE="$("$DOCKER_BIN" compose ps --format '{{.Service}}: {{.State}}' 2>/dev/null | grep '^backend:' || echo '')"
if [[ "$CONTAINER_STATE" != *"running"* ]]; then
    if [ "$AUTO_START_CONTAINER" = "true" ]; then
        log "Backend container is not currently running. Starting with docker compose up -d backend..."
        "$DOCKER_BIN" compose up -d backend
        sleep 5
    else
        log "ERROR: Backend container is not running ($CONTAINER_STATE). Skipping."
        exit 1
    fi
fi

# Wait up to 30s for Wi-Fi & DNS to establish after wake
WAIT_MAX=30
WAIT_COUNT=0
while ! /usr/bin/dscacheutil -q host -a name firestore.googleapis.com >/dev/null 2>&1 && [ $WAIT_COUNT -lt $WAIT_MAX ]; do
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
done
if [ $WAIT_COUNT -gt 0 ]; then
    log "Network & DNS ready in ${WAIT_COUNT}s."
fi

# STEP 1: Run 'pick:sd' (max 5 minutes)
log "─── [1/4] Executing: docker compose exec -T backend npm run pick:sd ───"
STEP1_START=$(date +%s)
if run_with_timeout 300 "$DOCKER_BIN" compose exec -T backend npm run pick:sd; then
    STEP1_DURATION=$(( $(date +%s) - STEP1_START ))
    log "Step 1/4 (pick:sd) succeeded in ${STEP1_DURATION}s."
else
    STEP1_CODE=$?
    STEP1_DURATION=$(( $(date +%s) - STEP1_START ))
    log "ERROR: Step 1/4 (pick:sd) failed with exit code $STEP1_CODE after ${STEP1_DURATION}s."
fi

# STEP 2: Run 'sync' (Only after 'pick:sd' finished, max 10 minutes)
log "─── [2/4] Executing: docker compose exec -T backend npm run sync ───"
STEP2_START=$(date +%s)
if run_with_timeout 600 "$DOCKER_BIN" compose exec -T backend npm run sync; then
    STEP2_DURATION=$(( $(date +%s) - STEP2_START ))
    log "Step 2/4 (sync) succeeded in ${STEP2_DURATION}s."
else
    STEP2_CODE=$?
    STEP2_DURATION=$(( $(date +%s) - STEP2_START ))
    log "ERROR: Step 2/4 (sync) failed with exit code $STEP2_CODE after ${STEP2_DURATION}s."
fi

# STEP 3: Run 'announce:discord' (Only posts when QOTD+SD detected, once per day, max 2 minutes)
log "─── [3/4] Executing: docker compose exec -T backend npm run announce:discord ───"
STEP3_START=$(date +%s)
if run_with_timeout 120 "$DOCKER_BIN" compose exec -T backend npm run announce:discord; then
    STEP3_DURATION=$(( $(date +%s) - STEP3_START ))
    log "Step 3/4 (announce:discord) succeeded in ${STEP3_DURATION}s."
else
    STEP3_CODE=$?
    STEP3_DURATION=$(( $(date +%s) - STEP3_START ))
    log "WARNING: Step 3/4 (announce:discord) exited with code $STEP3_CODE after ${STEP3_DURATION}s."
fi

# STEP 4: Run 'announce:sd-solution' (Unlocks at 6:00 PM IST, LLM generated, once per day, max 3 minutes)
log "─── [4/4] Executing: docker compose exec -T backend npm run announce:sd-solution ───"
STEP4_START=$(date +%s)
if run_with_timeout 180 "$DOCKER_BIN" compose exec -T backend npm run announce:sd-solution; then
    STEP4_DURATION=$(( $(date +%s) - STEP4_START ))
    log "Step 4/4 (announce:sd-solution) succeeded in ${STEP4_DURATION}s."
else
    STEP4_CODE=$?
    STEP4_DURATION=$(( $(date +%s) - STEP4_START ))
    log "WARNING: Step 4/4 (announce:sd-solution) exited with code $STEP4_CODE after ${STEP4_DURATION}s."
fi

TOTAL_DURATION=$(( $(date +%s) - START_TIME ))
log "Winter Arc Hourly Task Execution completed in ${TOTAL_DURATION}s."
log "Releasing power assertions; Mac may now return to sleep if idle."
log "================================================================================\n"

exit 0
