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
# 3. Lockfile Handling (Prevent Overlapping Executions)
# ------------------------------------------------------------------------------
acquire_lock() {
    if ( set -o noclobber; echo "$$" > "$LOCK_FILE" ) 2>/dev/null; then
        # Lock acquired
        trap 'release_lock' EXIT INT TERM
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
            trap 'release_lock' EXIT INT TERM
            return 0
        fi
    fi
}

release_lock() {
    rm -f "$LOCK_FILE"
}

acquire_lock

# ------------------------------------------------------------------------------
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

# Check power source
BATT_STATUS="$("$PMSET_BIN" -g batt 2>/dev/null || echo '')"
if [[ "$BATT_STATUS" == *"Battery Power"* ]]; then
    log "NOTE: Mac is on Battery Power. macOS disables background sleep assertions with the lid closed unless connected to AC power."
fi
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

# STEP 1: Run 'pick:sd' (max 5 minutes)
log "─── [1/3] Executing: docker compose exec -T backend npm run pick:sd ───"
STEP1_START=$(date +%s)
if run_with_timeout 300 "$DOCKER_BIN" compose exec -T backend npm run pick:sd; then
    STEP1_DURATION=$(( $(date +%s) - STEP1_START ))
    log "Step 1/3 (pick:sd) succeeded in ${STEP1_DURATION}s."
else
    STEP1_CODE=$?
    STEP1_DURATION=$(( $(date +%s) - STEP1_START ))
    log "ERROR: Step 1/3 (pick:sd) failed with exit code $STEP1_CODE after ${STEP1_DURATION}s."
fi

# STEP 2: Run 'sync' (Only after 'pick:sd' finished, max 10 minutes)
log "─── [2/3] Executing: docker compose exec -T backend npm run sync ───"
STEP2_START=$(date +%s)
if run_with_timeout 600 "$DOCKER_BIN" compose exec -T backend npm run sync; then
    STEP2_DURATION=$(( $(date +%s) - STEP2_START ))
    log "Step 2/3 (sync) succeeded in ${STEP2_DURATION}s."
else
    STEP2_CODE=$?
    STEP2_DURATION=$(( $(date +%s) - STEP2_START ))
    log "ERROR: Step 2/3 (sync) failed with exit code $STEP2_CODE after ${STEP2_DURATION}s."
fi

# STEP 3: Run 'announce:discord' (Only posts once per day, idempotent, max 2 minutes)
log "─── [3/3] Executing: docker compose exec -T backend npm run announce:discord ───"
STEP3_START=$(date +%s)
if run_with_timeout 120 "$DOCKER_BIN" compose exec -T backend npm run announce:discord; then
    STEP3_DURATION=$(( $(date +%s) - STEP3_START ))
    log "Step 3/3 (announce:discord) succeeded in ${STEP3_DURATION}s."
else
    STEP3_CODE=$?
    STEP3_DURATION=$(( $(date +%s) - STEP3_START ))
    log "WARNING: Step 3/3 (announce:discord) exited with code $STEP3_CODE after ${STEP3_DURATION}s."
fi

TOTAL_DURATION=$(( $(date +%s) - START_TIME ))
log "Winter Arc Hourly Task Execution completed in ${TOTAL_DURATION}s."
log "Releasing power assertions; Mac may now return to sleep if idle."
log "================================================================================\n"

exit 0
