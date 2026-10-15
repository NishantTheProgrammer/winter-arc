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
        <string>${APP_SUPPORT_DIR}/wake_helper.sh</string>
        <string>run</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${APP_SUPPORT_DIR}</string>

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

    local target_user="${SUDO_USER:-$USER}"
    local target_uid
    target_uid="$(id -u "$target_user")"
    local target_home
    target_home="$(eval echo "~$target_user")"
    local user_agent_plist="${target_home}/Library/LaunchAgents/${AGENT_LABEL}.plist"

    # Step 1: Clean up any old user-level LaunchAgent (user agents are frozen in DarkWake by macOS)
    echo -e "${BOLD}Step 1: Removing old user LaunchAgent (to enable true closed-lid DarkWake execution)...${NC}"
    if [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
        sudo -u "$target_user" launchctl bootout "gui/${target_uid}/${AGENT_LABEL}" 2>/dev/null || true
    else
        launchctl bootout "gui/${target_uid}/${AGENT_LABEL}" 2>/dev/null || true
    fi
    rm -f "$user_agent_plist" 2>/dev/null || true
    echo -e "  ${GREEN}✓ User LaunchAgent removed. Background execution moved to System LaunchDaemon.${NC}"

    # Step 2: Configure pmset wake schedule & LaunchDaemon (requires sudo)
    echo ""
    echo -e "${BOLD}Step 2: Configuring macOS wake scheduling (pmset + LaunchDaemon)...${NC}"
    echo -e "  This enables periodic waking when the Mac lid is closed / sleeping."
    
    echo -e "  Installing system wake helper in ${APP_SUPPORT_DIR}..."
    run_as_root mkdir -p "$APP_SUPPORT_DIR"
    run_as_root cp "${SCRIPT_DIR}/wake_helper.sh" "${APP_SUPPORT_DIR}/wake_helper.sh"
    run_as_root cp "${SCRIPT_DIR}/config.sh" "${APP_SUPPORT_DIR}/config.sh"
    run_as_root chmod -R 755 "$APP_SUPPORT_DIR"

    local temp_daemon_plist="/tmp/${DAEMON_LABEL}.plist"
    generate_daemon_plist "$temp_daemon_plist"

    echo -e "  Installing root wake daemon plist..."
    run_as_root cp "$temp_daemon_plist" "$SYSTEM_DAEMON_PLIST"
    run_as_root chown root:wheel "$SYSTEM_DAEMON_PLIST"
    run_as_root chmod 644 "$SYSTEM_DAEMON_PLIST"
    rm -f "$temp_daemon_plist"

    # Bootout previous and bootstrap new daemon
    run_as_root launchctl bootout "system/${DAEMON_LABEL}" 2>/dev/null || run_as_root launchctl unload "$SYSTEM_DAEMON_PLIST" 2>/dev/null || true
    sleep 0.5
    run_as_root launchctl bootstrap system "$SYSTEM_DAEMON_PLIST" 2>/dev/null || run_as_root launchctl load "$SYSTEM_DAEMON_PLIST" 2>/dev/null || true

    # Schedule initial batch of hourly wake events
    run_as_root "${APP_SUPPORT_DIR}/wake_helper.sh" schedule "$WAKE_HOURS_AHEAD"

    # Step 3: Configure passwordless pmset for seamless closed-lid execution on battery
    echo ""
    echo -e "${BOLD}Step 3: Configuring sudoers permission for closed-lid execution...${NC}"
    echo -e "  Allows run_tasks.sh to temporarily suspend sleep exclusively during task execution."
    local temp_sudoers="/tmp/winterarc_sudoers"
    echo "%admin ALL=(ALL) NOPASSWD: /usr/bin/pmset" > "$temp_sudoers"
    if run_as_root visudo -cf "$temp_sudoers" >/dev/null 2>&1; then
        run_as_root cp "$temp_sudoers" "$SUDOERS_FILE"
        run_as_root chown root:wheel "$SUDOERS_FILE"
        run_as_root chmod 440 "$SUDOERS_FILE"
        echo -e "  ${GREEN}✓ Sudoers permission configured for pmset in ${SUDOERS_FILE}.${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Could not validate sudoers syntax; skipping sudoers setup.${NC}"
    fi
    rm -f "$temp_sudoers"

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
        run_as_root "${APP_SUPPORT_DIR}/wake_helper.sh" schedule "$WAKE_HOURS_AHEAD"
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
        if [ -f "${APP_SUPPORT_DIR}/wake_helper.sh" ]; then
            run_as_root "${APP_SUPPORT_DIR}/wake_helper.sh" cancel
        else
            run_as_root "${SCRIPT_DIR}/wake_helper.sh" cancel 2>/dev/null || true
        fi
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

    # Remove sudoers rule
    if [ -f "$SUDOERS_FILE" ]; then
        run_as_root rm -f "$SUDOERS_FILE"
        echo -e "  Removed: $SUDOERS_FILE"
    fi

    # Remove application support directory
    if [ -d "$APP_SUPPORT_DIR" ]; then
        run_as_root rm -rf "$APP_SUPPORT_DIR"
        echo -e "  Removed: $APP_SUPPORT_DIR"
    fi

    # Ensure normal sleep mode is guaranteed active
    run_as_root "$PMSET_BIN" -a disablesleep 0 2>/dev/null || true

    rm -f "$LOCK_FILE"
    echo -e "${GREEN}${BOLD}✓ Scheduler completely uninstalled.${NC}"
}

# ------------------------------------------------------------------------------
# Command: STATUS
# ------------------------------------------------------------------------------
cmd_status() {
    local target_user="${SUDO_USER:-$USER}"
    local current_uid
    current_uid="$(id -u "$target_user")"

    echo -e "${BOLD}======================================================${NC}"
    echo -e "${BOLD}Winter Arc Scheduler Status${NC}"
    echo -e "${BOLD}======================================================${NC}"

    # 1. System LaunchDaemon Status (Primary runner for closed-lid execution)
    echo -n "• System LaunchDaemon ($DAEMON_LABEL): "
    if launchctl print "system/${DAEMON_LABEL}" >/dev/null 2>&1; then
        echo -e "${GREEN}LOADED & ACTIVE (Runs in DarkWake with lid closed)${NC}"
        local next_run_time
        next_run_time="$(date -v+1H -v00M -v00S '+%H:%M:%S (%A, %b %d)')"
        echo -e "• Next Scheduled Run: ${CYAN}${next_run_time}${NC} (hourly at :00)"
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
# Command: TEST-WAKE (Test closed-lid execution in N minutes)
# ------------------------------------------------------------------------------
cmd_test_wake() {
    local input="${1:-2}"
    local target_hour target_min target_time human_time

    if [[ "$input" =~ ^([0-9]{1,2}):([0-9]{2}) ]]; then
        target_hour="${BASH_REMATCH[1]}"
        target_min="${BASH_REMATCH[2]}"
        # If hour is 11 and current hour is >= 12, assume PM (23)
        if [ "$target_hour" -eq 11 ] && [ "$(date +%H)" -ge 12 ]; then
            target_hour=23
        fi
        target_time="$(date -v${target_hour}H -v${target_min}M -v00S '+%m/%d/%y %H:%M:%S')"
        human_time="$(date -v${target_hour}H -v${target_min}M -v00S '+%H:%M:00 (%I:%M %p)')"
    else
        local mins="${input}"
        target_time="$(date -v+${mins}M -v00S '+%m/%d/%y %H:%M:%S')"
        target_min="$(date -v+${mins}M '+%-M')"
        target_hour="$(date -v+${mins}M '+%-H')"
        human_time="$(date -v+${mins}M '+%H:%M:00 (%I:%M %p)')"
    fi

    echo -e "${CYAN}${BOLD}⚡ Setting up Closed-Lid Wake Execution for ${human_time}...${NC}"
    
    # Ensure fresh copies of helper and config are installed in APP_SUPPORT_DIR
    run_as_root mkdir -p "$APP_SUPPORT_DIR"
    run_as_root cp "${SCRIPT_DIR}/wake_helper.sh" "${APP_SUPPORT_DIR}/wake_helper.sh"
    run_as_root cp "${SCRIPT_DIR}/config.sh" "${APP_SUPPORT_DIR}/config.sh"
    run_as_root chmod -R 755 "$APP_SUPPORT_DIR"

    # 1. Schedule pmset RTC wake
    run_as_root "$PMSET_BIN" schedule wakeorpoweron "$target_time" "$PMSET_OWNER" 2>/dev/null || \
    run_as_root "$PMSET_BIN" schedule wake "$target_time" "$PMSET_OWNER" 2>/dev/null
    
    # 2. Update LaunchDaemon to trigger at target_hour:target_min as well
    local temp_daemon_plist="/tmp/${DAEMON_LABEL}.plist"
    cat <<EOF > "$temp_daemon_plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${DAEMON_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${APP_SUPPORT_DIR}/wake_helper.sh</string>
        <string>run</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${APP_SUPPORT_DIR}</string>

    <key>StartCalendarInterval</key>
    <array>
        <dict>
            <key>Hour</key>
            <integer>${target_hour}</integer>
            <key>Minute</key>
            <integer>${target_min}</integer>
        </dict>
        <dict>
            <key>Minute</key>
            <integer>0</integer>
        </dict>
    </array>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/wake.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/wake.stderr.log</string>
</dict>
</plist>
EOF
    chmod 644 "$temp_daemon_plist"
    run_as_root cp "$temp_daemon_plist" "$SYSTEM_DAEMON_PLIST"
    run_as_root chown root:wheel "$SYSTEM_DAEMON_PLIST"
    run_as_root chmod 644 "$SYSTEM_DAEMON_PLIST"
    rm -f "$temp_daemon_plist"

    # Reload LaunchDaemon
    run_as_root launchctl bootout "system/${DAEMON_LABEL}" 2>/dev/null || true
    sleep 0.5
    run_as_root launchctl bootstrap system "$SYSTEM_DAEMON_PLIST" 2>/dev/null || run_as_root launchctl load "$SYSTEM_DAEMON_PLIST" 2>/dev/null || true

    echo -e "${GREEN}${BOLD}✓ Test scheduled for ${human_time}!${NC}"
    echo -e "${YELLOW}👉 Close your laptop lid on battery power NOW.${NC}"
    echo -e "Your Mac will sleep, wake at ${human_time} with lid closed, and post 'hi' to Discord!"
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
    test-wake)
        cmd_test_wake "${2:-2}"
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
