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
    exec "$CAFFEINATE_BIN" -ims "$0" "$@"
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
# 4. Task Execution
# ------------------------------------------------------------------------------
START_TIME=$(date +%s)
log "================================================================================"
log "Starting Winter Arc Hourly Task Execution (PID: $$)"
log "Project Directory: $PROJECT_DIR"
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

# STEP 1: Run 'pick:sd'
log "─── [1/2] Executing: docker compose exec -T backend npm run pick:sd ───"
STEP1_START=$(date +%s)
if "$DOCKER_BIN" compose exec -T backend npm run pick:sd; then
    STEP1_DURATION=$(( $(date +%s) - STEP1_START ))
    log "Step 1/2 (pick:sd) succeeded in ${STEP1_DURATION}s."
else
    STEP1_CODE=$?
    STEP1_DURATION=$(( $(date +%s) - STEP1_START ))
    log "ERROR: Step 1/2 (pick:sd) failed with exit code $STEP1_CODE after ${STEP1_DURATION}s."
fi

# STEP 2: Run 'sync' (Only after 'pick:sd' finished)
log "─── [2/2] Executing: docker compose exec -T backend npm run sync ───"
STEP2_START=$(date +%s)
if "$DOCKER_BIN" compose exec -T backend npm run sync; then
    STEP2_DURATION=$(( $(date +%s) - STEP2_START ))
    log "Step 2/2 (sync) succeeded in ${STEP2_DURATION}s."
else
    STEP2_CODE=$?
    STEP2_DURATION=$(( $(date +%s) - STEP2_START ))
    log "ERROR: Step 2/2 (sync) failed with exit code $STEP2_CODE after ${STEP2_DURATION}s."
fi

TOTAL_DURATION=$(( $(date +%s) - START_TIME ))
log "Winter Arc Hourly Task Execution completed in ${TOTAL_DURATION}s."
log "Releasing power assertions; Mac may now return to sleep if idle."
log "================================================================================\n"

exit 0
