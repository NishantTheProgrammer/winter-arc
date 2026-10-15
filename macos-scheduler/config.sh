#!/usr/bin/env bash
# ==============================================================================
# Configuration for Winter Arc macOS Scheduler
# ==============================================================================

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Project Root Directory
# Can be overridden by setting the PROJECT_DIR environment variable
DEFAULT_PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
export PROJECT_DIR="${PROJECT_DIR:-$DEFAULT_PROJECT_DIR}"

# Binaries
export DOCKER_BIN="${DOCKER_BIN:-$(which docker 2>/dev/null || echo '/usr/local/bin/docker')}"
export CAFFEINATE_BIN="${CAFFEINATE_BIN:-/usr/bin/caffeinate}"
export PMSET_BIN="${PMSET_BIN:-/usr/bin/pmset}"
export LAUNCHCTL_BIN="${LAUNCHCTL_BIN:-/bin/launchctl}"

# Ensure PATH covers standard user and Homebrew locations
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME:-/Users/nishant}/.local/bin:${PATH:-/usr/bin:/bin}"

# Scheduler Identifiers
export AGENT_LABEL="com.winterarc.hourlysync"
export DAEMON_LABEL="com.winterarc.wakescheduler"
export PMSET_OWNER="winter-arc-sync"

# Directories & Files
export LOG_DIR="${SCRIPT_DIR}/logs"
export LOG_FILE="${LOG_DIR}/scheduler.log"
export LOCK_FILE="${LOG_DIR}/scheduler.lock"

# Plist destination paths
export USER_AGENT_PLIST="${HOME:-/Users/nishant}/Library/LaunchAgents/${AGENT_LABEL}.plist"
export SYSTEM_DAEMON_PLIST="/Library/LaunchDaemons/${DAEMON_LABEL}.plist"
export SUDOERS_FILE="/etc/sudoers.d/winterarc"
export APP_SUPPORT_DIR="/Library/Application Support/WinterArc"

# Scheduling Settings
# Hours ahead to keep scheduled in pmset wake table (default: 24 hours)
export WAKE_HOURS_AHEAD=24

# Auto-start backend container if not currently running (true/false)
export AUTO_START_CONTAINER=true
