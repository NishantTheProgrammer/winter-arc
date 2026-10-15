#!/usr/bin/env bash
# ==============================================================================
# Winter Arc - macOS Wake Event Scheduler (pmset helper)
# Configures and manages native macOS RTC wake events via `pmset schedule`.
# Requires root privileges (invoked via sudo or system LaunchDaemon).
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

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "ERROR: pmset schedule operations require root privileges." >&2
        echo "Please re-run this command with sudo: sudo $0 $*" >&2
        exit 1
    fi
}

cmd_schedule() {
    check_root
    local hours="${1:-$WAKE_HOURS_AHEAD}"
    echo "Configuring macOS power management settings for background wake (Battery & AC)..."
    "$PMSET_BIN" -a womp 1 2>/dev/null || true
    "$PMSET_BIN" -a powernap 1 2>/dev/null || true
    "$PMSET_BIN" -b womp 1 2>/dev/null || true
    "$PMSET_BIN" -b powernap 1 2>/dev/null || true
    "$PMSET_BIN" -b tcpkeepalive 1 2>/dev/null || true

    echo "Scheduling upcoming $hours hourly wake events (owner: $PMSET_OWNER)..."
    local count=0
    for (( i=1; i<=hours; i++ )); do
        local wake_time
        wake_time="$(date -v+${i}H -v00M -v00S "+%m/%d/%y %H:%M:%S")"
        if "$PMSET_BIN" schedule wakeorpoweron "$wake_time" "$PMSET_OWNER" 2>/dev/null || \
           "$PMSET_BIN" schedule wake "$wake_time" "$PMSET_OWNER" 2>/dev/null; then
            count=$((count + 1))
        fi
    done
    echo "Successfully scheduled $count wake events."
}

cmd_cancel() {
    check_root
    echo "Cancelling scheduled wake events for owner '$PMSET_OWNER'..."
    local raw_sched
    raw_sched="$("$PMSET_BIN" -g sched 2>/dev/null || true)"

    # Parse entries matching our owner
    local count=0
    while IFS= read -r line; do
        if [[ "$line" == *"$PMSET_OWNER"* ]]; then
            # Format: [X] wake at MM/dd/yyyy HH:mm:ss by 'winter-arc-sync'
            # Extract date and time
            local date_str time_str
            date_str="$(echo "$line" | grep -oE '[0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4}')"
            time_str="$(echo "$line" | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}')"

            if [ -n "$date_str" ] && [ -n "$time_str" ]; then
                # Convert 4-digit year to 2-digit if needed (e.g., 2026 -> 26)
                local short_date
                short_date="$(echo "$date_str" | sed -E 's#/20([0-9]{2})$#/\1#')"
                "$PMSET_BIN" schedule cancel wakeorpoweron "${short_date} ${time_str}" "$PMSET_OWNER" 2>/dev/null || \
                "$PMSET_BIN" schedule cancel wake "${short_date} ${time_str}" "$PMSET_OWNER" 2>/dev/null || \
                "$PMSET_BIN" schedule cancel wakeorpoweron "${date_str} ${time_str}" "$PMSET_OWNER" 2>/dev/null || \
                "$PMSET_BIN" schedule cancel wake "${date_str} ${time_str}" "$PMSET_OWNER" 2>/dev/null || true
                count=$((count + 1))
            fi
        fi
    done <<< "$raw_sched"

    echo "Cancelled $count events owned by '$PMSET_OWNER'."
}

cmd_status() {
    echo "=== Current macOS Power Settings & Scheduled Events ==="
    echo "Power assertion / sleep mode:"
    "$PMSET_BIN" -g live 2>/dev/null | grep -E '^(sleep|powernap|womp|displaysleep|hibernatemode)' || true
    echo ""
    echo "Active Scheduled Events in pmset:"
    local sched_output
    sched_output="$("$PMSET_BIN" -g sched 2>/dev/null || true)"
    if [ -n "$sched_output" ]; then
        echo "$sched_output"
    else
        echo "(No scheduled wake/sleep events found)"
    fi
}

cmd_refresh() {
    check_root
    # Count currently scheduled events for PMSET_OWNER
    local active_count
    active_count="$("$PMSET_BIN" -g sched 2>/dev/null | grep -c "$PMSET_OWNER" || echo 0)"
    if [ "$active_count" -lt 12 ]; then
        cmd_schedule "$WAKE_HOURS_AHEAD"
    fi
}

cmd_run() {
    check_root
    local log_file="${LOG_FILE:-${SCRIPT_DIR}/logs/scheduler.log}"
    mkdir -p "$(dirname "$log_file")" 2>/dev/null || true
    
    # 1. Replenish scheduled wake events
    cmd_refresh >> "$log_file" 2>&1 || true
    
    # 2. Prevent sleep while running
    "$PMSET_BIN" -a disablesleep 1 2>/dev/null || true
    trap '"$PMSET_BIN" -a disablesleep 0 2>/dev/null || true' EXIT INT TERM
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚡ [System Daemon] Closed-lid execution started (PID: $$)" >> "$log_file"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Power State: $("$PMSET_BIN" -g batt 2>/dev/null | grep -oE "'.*'" || echo 'Unknown')" >> "$log_file"

    export DOCKER_HOST="unix:///Users/nishant/.docker/run/docker.sock"
    local container="${BACKEND_CONTAINER:-winter-arc-backend-1}"

    # STEP 1: pick:sd
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ─── [1/4] Executing: npm run pick:sd ───" >> "$log_file"
    "$DOCKER_BIN" exec -i "$container" npm run pick:sd >> "$log_file" 2>&1 || true

    # STEP 2: sync
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ─── [2/4] Executing: npm run sync ───" >> "$log_file"
    "$DOCKER_BIN" exec -i "$container" npm run sync >> "$log_file" 2>&1 || true

    # STEP 3: announce:discord
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ─── [3/4] Executing: npm run announce:discord ───" >> "$log_file"
    "$DOCKER_BIN" exec -i "$container" npm run announce:discord >> "$log_file" 2>&1 || true

    # STEP 4: announce:sd-solution
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ─── [4/4] Executing: npm run announce:sd-solution ───" >> "$log_file"
    "$DOCKER_BIN" exec -i "$container" npm run announce:sd-solution >> "$log_file" 2>&1 || true

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🌙 [System Daemon] Winter Arc Execution Completed. Restoring sleep." >> "$log_file"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ================================================================================\n" >> "$log_file"
    "$PMSET_BIN" -a disablesleep 0 2>/dev/null || true
}

case "${1:-status}" in
    schedule)
        cmd_schedule "${2:-$WAKE_HOURS_AHEAD}"
        ;;
    cancel)
        cmd_cancel
        ;;
    status)
        cmd_status
        ;;
    refresh)
        cmd_refresh
        ;;
    run)
        cmd_run
        ;;
    *)
        echo "Usage: $0 {schedule [hours]|cancel|status|refresh|run}" >&2
        exit 1
        ;;
esac
