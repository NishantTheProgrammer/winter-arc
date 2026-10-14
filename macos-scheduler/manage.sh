#!/usr/bin/env bash
# ==============================================================================
# Winter Arc - macOS Scheduler Manager
# Unified CLI for setup, start, stop, uninstall, status, run-now, logs
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

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Helper for sudo commands
run_as_root() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

# ------------------------------------------------------------------------------
# Generate LaunchAgent Plist (Runs in user session with Docker access)
# ------------------------------------------------------------------------------
generate_agent_plist() {
    local target_file="$1"
    mkdir -p "$(dirname "$target_file")"
    cat <<EOF > "$target_file"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${AGENT_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/osascript</string>
        <string>-e</string>
        <string>do shell script "${SCRIPT_DIR}/run_tasks.sh"</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/tmp</string>

    <!-- Run at minute 00 of every hour -->
    <key>StartCalendarInterval</key>
    <dict>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>ProcessType</key>
    <string>Background</string>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd.stderr.log</string>
</dict>
</plist>
EOF
    chmod 644 "$target_file"
}

# ------------------------------------------------------------------------------
# Generate LaunchDaemon Plist (Runs as root to replenish pmset wake events)
# ------------------------------------------------------------------------------
generate_daemon_plist() {
    local target_file="$1"
    cat <<EOF > "$target_file"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${DAEMON_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${SCRIPT_DIR}/wake_helper.sh</string>
        <string>refresh</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>

    <!-- Run every hour to keep upcoming pmset wake events populated -->
    <key>StartCalendarInterval</key>
    <dict>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/wake.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/wake.stderr.log</string>
</dict>
</plist>
EOF
    chmod 644 "$target_file"
}

# ------------------------------------------------------------------------------
# Command: SETUP
# ------------------------------------------------------------------------------
cmd_setup() {
    local custom_dir="${1:-}"
    if [ -n "$custom_dir" ]; then
        if [ -d "$custom_dir" ]; then
            PROJECT_DIR="$(cd "$custom_dir" && pwd)"
            echo -e "${CYAN}Using custom project directory: ${PROJECT_DIR}${NC}"
        else
            echo -e "${RED}ERROR: Specified directory does not exist: $custom_dir${NC}" >&2
            exit 1
        fi
    fi

    echo -e "${BOLD}======================================================${NC}"
    echo -e "${BOLD}❄️  Winter Arc - macOS Scheduler Setup${NC}"
    echo -e "${BOLD}======================================================${NC}"
    echo -e "Project Directory : ${CYAN}${PROJECT_DIR}${NC}"
    echo -e "Log Directory     : ${CYAN}${LOG_DIR}${NC}"
    echo -e "Docker Binary     : ${CYAN}${DOCKER_BIN}${NC}"
    echo ""

    # Ensure scripts are executable
    chmod +x "${SCRIPT_DIR}/config.sh" "${SCRIPT_DIR}/run_tasks.sh" "${SCRIPT_DIR}/wake_helper.sh" "${SCRIPT_DIR}/manage.sh"
    mkdir -p "$LOG_DIR"

    # Step 1: Install LaunchAgent in user domain
    echo -e "${BOLD}Step 1: Installing user LaunchAgent...${NC}"
    mkdir -p "$HOME/Library/LaunchAgents"
    generate_agent_plist "$USER_AGENT_PLIST"
    echo -e "  Created: ${USER_AGENT_PLIST}"

    # Unload previous if loaded
    local current_uid
    current_uid="$(id -u)"
    launchctl bootout "gui/${current_uid}/${AGENT_LABEL}" 2>/dev/null || launchctl unload "$USER_AGENT_PLIST" 2>/dev/null || true
    sleep 0.5

    # Bootstrap
    if launchctl bootstrap "gui/${current_uid}" "$USER_AGENT_PLIST" 2>/dev/null; then
        echo -e "  ${GREEN}✓ LaunchAgent loaded successfully via launchctl bootstrap.${NC}"
    elif launchctl load "$USER_AGENT_PLIST" 2>/dev/null; then
        echo -e "  ${GREEN}✓ LaunchAgent loaded successfully via launchctl load.${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Note: Could not bootstrap immediately; will activate on next login or run.${NC}"
    fi

    # Step 2: Configure pmset wake schedule & LaunchDaemon (requires sudo)
    echo ""
    echo -e "${BOLD}Step 2: Configuring macOS wake scheduling (pmset + LaunchDaemon)...${NC}"
    echo -e "  This enables periodic waking when the Mac lid is closed / sleeping."
    
    local temp_daemon_plist="/tmp/${DAEMON_LABEL}.plist"
    generate_daemon_plist "$temp_daemon_plist"

    echo -e "  Prompting for sudo to install root wake daemon and configure pmset..."
    run_as_root cp "$temp_daemon_plist" "$SYSTEM_DAEMON_PLIST"
    run_as_root chown root:wheel "$SYSTEM_DAEMON_PLIST"
    run_as_root chmod 644 "$SYSTEM_DAEMON_PLIST"
    rm -f "$temp_daemon_plist"

    # Bootout previous and bootstrap new daemon
    run_as_root launchctl bootout "system/${DAEMON_LABEL}" 2>/dev/null || run_as_root launchctl unload "$SYSTEM_DAEMON_PLIST" 2>/dev/null || true
    sleep 0.5
    run_as_root launchctl bootstrap system "$SYSTEM_DAEMON_PLIST" 2>/dev/null || run_as_root launchctl load "$SYSTEM_DAEMON_PLIST" 2>/dev/null || true

    # Schedule initial batch of hourly wake events
    run_as_root "${SCRIPT_DIR}/wake_helper.sh" schedule "$WAKE_HOURS_AHEAD"

    echo ""
    echo -e "${GREEN}${BOLD}🎉 Setup complete!${NC}"
    echo -e "Hourly execution is active. Run '${CYAN}./manage.sh status${NC}' to inspect."
}

# ------------------------------------------------------------------------------
# Command: START
# ------------------------------------------------------------------------------
cmd_start() {
    echo -e "${BOLD}Starting Winter Arc scheduler services...${NC}"
    local current_uid
    current_uid="$(id -u)"

    if [ ! -f "$USER_AGENT_PLIST" ]; then
        echo -e "${YELLOW}LaunchAgent plist not found. Running setup first...${NC}"
        cmd_setup
        return
    fi

    launchctl bootout "gui/${current_uid}/${AGENT_LABEL}" 2>/dev/null || launchctl unload "$USER_AGENT_PLIST" 2>/dev/null || true
    sleep 0.5
    if launchctl bootstrap "gui/${current_uid}" "$USER_AGENT_PLIST" 2>/dev/null || launchctl load "$USER_AGENT_PLIST" 2>/dev/null; then
        echo -e "  ${GREEN}✓ User LaunchAgent started.${NC}"
    else
        echo -e "  ${RED}Failed to load user LaunchAgent.${NC}"
    fi

    if [ -f "$SYSTEM_DAEMON_PLIST" ]; then
        run_as_root launchctl bootstrap system "$SYSTEM_DAEMON_PLIST" 2>/dev/null || run_as_root launchctl load "$SYSTEM_DAEMON_PLIST" 2>/dev/null || true
        run_as_root "${SCRIPT_DIR}/wake_helper.sh" schedule "$WAKE_HOURS_AHEAD"
        echo -e "  ${GREEN}✓ Wake scheduler daemon & pmset active.${NC}"
    fi
}

# ------------------------------------------------------------------------------
# Command: STOP
# ------------------------------------------------------------------------------
cmd_stop() {
    echo -e "${BOLD}Stopping Winter Arc scheduler services...${NC}"
    local current_uid
    current_uid="$(id -u)"

    # Unload user LaunchAgent
    launchctl bootout "gui/${current_uid}/${AGENT_LABEL}" 2>/dev/null || launchctl unload "$USER_AGENT_PLIST" 2>/dev/null || true
    echo -e "  ${GREEN}✓ User LaunchAgent unloaded.${NC}"

    # Unload root daemon & cancel pmset wakes if present
    if [ -f "$SYSTEM_DAEMON_PLIST" ]; then
        run_as_root launchctl bootout "system/${DAEMON_LABEL}" 2>/dev/null || run_as_root launchctl unload "$SYSTEM_DAEMON_PLIST" 2>/dev/null || true
        run_as_root "${SCRIPT_DIR}/wake_helper.sh" cancel
        echo -e "  ${GREEN}✓ System wake daemon unloaded & scheduled wake events cancelled.${NC}"
    fi

    # Clean active lock if any
    rm -f "$LOCK_FILE"
    echo -e "${GREEN}Scheduler stopped.${NC}"
}

# ------------------------------------------------------------------------------
# Command: UNINSTALL
# ------------------------------------------------------------------------------
cmd_uninstall() {
    echo -e "${BOLD}Uninstalling Winter Arc scheduler...${NC}"
    cmd_stop

    # Remove user agent plist
    if [ -f "$USER_AGENT_PLIST" ]; then
        rm -f "$USER_AGENT_PLIST"
        echo -e "  Removed: $USER_AGENT_PLIST"
    fi

    # Remove system daemon plist
    if [ -f "$SYSTEM_DAEMON_PLIST" ]; then
        run_as_root rm -f "$SYSTEM_DAEMON_PLIST"
        echo -e "  Removed: $SYSTEM_DAEMON_PLIST"
    fi

    rm -f "$LOCK_FILE"
    echo -e "${GREEN}${BOLD}✓ Scheduler completely uninstalled.${NC}"
}

# ------------------------------------------------------------------------------
# Command: STATUS
# ------------------------------------------------------------------------------
cmd_status() {
    local current_uid
    current_uid="$(id -u)"

    echo -e "${BOLD}======================================================${NC}"
    echo -e "${BOLD}Winter Arc Scheduler Status${NC}"
    echo -e "${BOLD}======================================================${NC}"

    # 1. LaunchAgent Status
    echo -n "• User LaunchAgent ($AGENT_LABEL): "
    if launchctl print "gui/${current_uid}/${AGENT_LABEL}" >/dev/null 2>&1; then
        echo -e "${GREEN}LOADED & ACTIVE${NC}"
        local agent_pid
        agent_pid="$(launchctl print "gui/${current_uid}/${AGENT_LABEL}" 2>/dev/null | grep -E 'pid = [0-9]+' | head -1 | awk '{print $3}' || echo '')"
        if [ -n "$agent_pid" ]; then
            echo -e "  Current Task PID: ${agent_pid}"
        fi
        local next_run_time
        next_run_time="$(date -v+1H -v00M -v00S '+%H:%M:%S (%A, %b %d)')"
        echo -e "• Next Scheduled Run: ${CYAN}${next_run_time}${NC} (runs every hour at :00)"
    else
        echo -e "${YELLOW}NOT LOADED${NC}"
    fi

    # 2. System Wake Daemon Status
    echo -n "• System WakeDaemon ($DAEMON_LABEL): "
    if launchctl print "system/${DAEMON_LABEL}" >/dev/null 2>&1; then
        echo -e "${GREEN}LOADED${NC}"
    else
        echo -e "${YELLOW}NOT LOADED${NC}"
    fi

    # 3. Execution Lock Status
    echo -n "• Overlap Lock: "
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid
        lock_pid="$(cat "$LOCK_FILE" 2>/dev/null || echo '')"
        if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
            echo -e "${YELLOW}BUSY (PID: $lock_pid actively running)${NC}"
        else
            echo -e "${YELLOW}Stale lock file exists (PID: $lock_pid dead)${NC}"
        fi
    else
        echo -e "${GREEN}IDLE (No task running)${NC}"
    fi

    # 4. Docker Backend Service Status
    echo -n "• Docker Container (backend): "
    local container_state
    container_state="$("$DOCKER_BIN" compose -f "${PROJECT_DIR}/docker-compose.yml" ps --format '{{.Service}}: {{.State}}' 2>/dev/null | grep '^backend:' || echo '')"
    if [[ "$container_state" == *"running"* ]]; then
        echo -e "${GREEN}$container_state${NC}"
    elif [ -n "$container_state" ]; then
        echo -e "${YELLOW}$container_state${NC}"
    else
        echo -e "${RED}NOT RUNNING${NC}"
    fi

    # 5. Scheduled Wake Events
    echo ""
    echo -e "${BOLD}• Scheduled Wake Events (pmset):${NC}"
    local sched_entries
    sched_entries="$("$PMSET_BIN" -g sched 2>/dev/null | grep "$PMSET_OWNER" || echo '')"
    if [ -n "$sched_entries" ]; then
        echo "$sched_entries" | head -n 6
        local total_wakes
        total_wakes="$(echo "$sched_entries" | wc -l | tr -d ' ')"
        echo -e "  (Total '$PMSET_OWNER' wakes scheduled: ${CYAN}${total_wakes}${NC})"
    else
        echo -e "  ${YELLOW}No wake events scheduled for '$PMSET_OWNER'.${NC}"
    fi

    # 6. Last Log Entries
    echo ""
    echo -e "${BOLD}• Recent Log Activity (${LOG_FILE}):${NC}"
    if [ -f "$LOG_FILE" ]; then
        tail -n 12 "$LOG_FILE"
    else
        echo "  (No log file found yet)"
    fi
}

# ------------------------------------------------------------------------------
# Command: RUN-NOW (Immediate manual execution)
# ------------------------------------------------------------------------------
cmd_run_now() {
    echo -e "${CYAN}Executing Winter Arc tasks immediately in foreground...${NC}"
    "${SCRIPT_DIR}/run_tasks.sh"
}

# ------------------------------------------------------------------------------
# Command: LOGS
# ------------------------------------------------------------------------------
cmd_logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -n 50 -f "$LOG_FILE"
    else
        echo "Log file $LOG_FILE does not exist yet. Run './manage.sh run-now' to generate logs."
    fi
}

# ------------------------------------------------------------------------------
# Main Dispatcher
# ------------------------------------------------------------------------------
case "${1:-status}" in
    setup)
        cmd_setup "${2:-}"
        ;;
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_stop
        sleep 1
        cmd_start
        ;;
    status)
        cmd_status
        ;;
    run-now)
        cmd_run_now
        ;;
    logs)
        cmd_logs
        ;;
    uninstall)
        cmd_uninstall
        ;;
    help|--help|-h)
        echo "Winter Arc macOS Scheduler"
        echo "Usage: $0 {setup [dir]|start|stop|restart|status|run-now|logs|uninstall}"
        ;;
    *)
        echo "Usage: $0 {setup [dir]|start|stop|restart|status|run-now|logs|uninstall}" >&2
        exit 1
        ;;
esac
