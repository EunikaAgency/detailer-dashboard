#!/usr/bin/env bash
set -euo pipefail

IFS=$'\n\t'
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CONFIG_FILE="/etc/server-audit-report.conf"
WINDOW_HOURS=24
HISTORY_DAYS=5
BASE_DIR="/var/local/server-audit"
REPORT_DIR=""
STATE_DIR=""
ENABLE_PRUNE=0
REPORT_RETENTION_DAYS=90
STATE_RETENTION_DAYS=30
MAX_DETAIL_LINES=40

declare -a EXTRA_WEBROOTS=()
declare -a SENSITIVE_DIRS=(
  "/etc"
  "/usr/local/bin"
  "/usr/local/sbin"
  "/var/spool/cron"
  "/etc/cron.d"
  "/etc/cron.daily"
  "/etc/cron.hourly"
  "/etc/cron.monthly"
  "/etc/cron.weekly"
  "/etc/systemd/system"
  "/lib/systemd/system"
  "/etc/apache2"
  "/etc/ssh"
  "/etc/sudoers.d"
  "/etc/logrotate.d"
  "/etc/ufw"
  "/etc/fail2ban"
)
declare -a CONFIG_HASH_PATHS=(
  "/etc/passwd"
  "/etc/group"
  "/etc/shadow"
  "/etc/gshadow"
  "/etc/sudoers"
  "/etc/sudoers.d"
  "/etc/ssh/sshd_config"
  "/etc/ssh/sshd_config.d"
  "/etc/apache2"
  "/etc/systemd/system"
  "/lib/systemd/system"
  "/etc/crontab"
  "/etc/cron.d"
  "/etc/cron.daily"
  "/etc/cron.hourly"
  "/etc/cron.monthly"
  "/etc/cron.weekly"
  "/var/spool/cron"
  "/etc/anacrontab"
  "/etc/logrotate.conf"
  "/etc/logrotate.d"
  "/etc/default/ufw"
  "/etc/ufw"
  "/etc/nftables.conf"
  "/etc/fail2ban"
  "/root/.bashrc"
  "/root/.profile"
  "/root/.bash_profile"
)

SENSITIVE_EXCLUDE_REGEX='^/etc/(ssl/certs|alternatives)/|^/etc/letsencrypt/(archive|live)/'
WEBROOT_EXCLUDE_REGEX='/(cache|tmp|node_modules|\.git|\.next)(/|$)|/wp-content/cache(/|$)|/uploads/converted(/|$)'
SECURITY_SENSITIVE_PACKAGE_REGEX='^(openssh|nmap|tcpdump|wireshark|netcat|ncat|hydra|john|hashcat|rkhunter|chkrootkit|telnet|vsftpd|ftp|socat|ngrok|cloudflared|teamviewer|anydesk|docker|podman|kubectl|kubelet|openvpn|wireguard|fail2ban)'

RUN_ID=""
RUN_DATE=""
NOW_EPOCH=""
WINDOW_START_EPOCH=""
NOW_ISO=""
WINDOW_START_ISO=""
WORKDIR=""
CURRENT_STATE_DIR=""
CURRENT_REPORT=""
TMP_COMPARE_DIR=""
NOTES_FILE=""

PREVIOUS_SNAPSHOT_DIR=""
declare -a HISTORY_SNAPSHOT_DIRS=()

ATTENTION_LEVEL="no major issues"

declare -i FAILED_SSH_COUNT=0
declare -i SUCCESS_SSH_COUNT=0
declare -i ROOT_LOGIN_ATTEMPT_COUNT=0
declare -i SUDO_EVENT_COUNT=0
declare -i PACKAGE_EVENT_COUNT=0
declare -i NEW_PACKAGE_COUNT=0
declare -i NEW_SECURITY_PACKAGE_COUNT=0
declare -i NEW_PORT_COUNT=0
declare -i NEW_PORT_5D_COUNT=0
declare -i NEW_ENABLED_SERVICE_COUNT=0
declare -i NEW_ENABLED_SERVICE_5D_COUNT=0
declare -i NEW_USER_COUNT=0
declare -i REMOVED_USER_COUNT=0
declare -i USER_GROUP_CHANGE_COUNT=0
declare -i CONFIG_CHANGE_COUNT=0
declare -i CONFIG_STABLE_BREAK_COUNT=0
declare -i CRON_OR_PERSISTENCE_CHANGE_COUNT=0
declare -i SENSITIVE_RECENT_COUNT=0
declare -i SENSITIVE_NEW_FILE_COUNT=0
declare -i SENSITIVE_REMOVED_FILE_COUNT=0
declare -i WEBROOT_SUSPICIOUS_COUNT=0
declare -i WEBROOT_PERMISSION_FLAG_COUNT=0
declare -i FAILED_SERVICE_COUNT=0
declare -i JOURNAL_WARNING_COUNT=0
declare -i DISK_GROWTH_ALERT_COUNT=0

usage() {
  cat <<'EOF'
Usage: security-audit-report.sh [--config FILE] [--base-dir DIR] [--window-hours N]

Passive daily reporting tool for Ubuntu production servers.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      CONFIG_FILE="$2"
      shift 2
      ;;
    --base-dir)
      BASE_DIR="$2"
      shift 2
      ;;
    --window-hours)
      WINDOW_HOURS="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

REPORT_DIR="${REPORT_DIR:-$BASE_DIR/reports}"
STATE_DIR="${STATE_DIR:-$BASE_DIR/state}"

RUN_ID="$(date '+%Y-%m-%d_%H%M%S')"
RUN_DATE="$(date '+%F')"
NOW_EPOCH="$(date +%s)"
WINDOW_START_EPOCH="$((NOW_EPOCH - WINDOW_HOURS * 3600))"
NOW_ISO="$(date -d "@$NOW_EPOCH" '+%Y-%m-%d %H:%M:%S %z')"
WINDOW_START_ISO="$(date -d "@$WINDOW_START_EPOCH" '+%Y-%m-%d %H:%M:%S %z')"

WORKDIR="$(mktemp -d -t server-audit.XXXXXX)"
CURRENT_STATE_DIR="$WORKDIR/state"
TMP_COMPARE_DIR="$WORKDIR/compare"
mkdir -p "$CURRENT_STATE_DIR" "$TMP_COMPARE_DIR"
NOTES_FILE="$WORKDIR/notes.txt"

cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

note() {
  printf '%s\n' "$*" >> "$NOTES_FILE"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

sorted_unique_copy() {
  local src="$1"
  local dst="$2"
  if [[ -f "$src" ]]; then
    sort -u "$src" > "$dst"
  else
    : > "$dst"
  fi
}

filter_regex() {
  local regex="$1"
  if [[ -n "$regex" ]]; then
    grep -Ev "$regex" || true
  else
    cat
  fi
}

tail_limit() {
  local file="$1"
  local lines="${2:-$MAX_DETAIL_LINES}"
  if [[ -s "$file" ]]; then
    sed -n "1,${lines}p" "$file"
  else
    printf 'none\n'
  fi
}

count_file_lines() {
  local file="$1"
  if [[ -s "$file" ]]; then
    wc -l < "$file" | awk '{print $1}'
  else
    printf '0\n'
  fi
}

grep_count_or_zero() {
  local pattern="$1"
  local file="$2"
  local value
  value="$(grep -Ec "$pattern" "$file" 2>/dev/null || true)"
  value="$(printf '%s\n' "$value" | tail -n 1)"
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$value"
  else
    printf '0\n'
  fi
}

ensure_dirs() {
  mkdir -p "$REPORT_DIR" "$STATE_DIR/snapshots"
}

read_text_bundle() {
  local path
  for path in "$@"; do
    [[ -e "$path" ]] || continue
    if [[ "$path" == *.gz ]]; then
      gzip -cd -- "$path" 2>/dev/null || note "Unable to read compressed log: $path"
    else
      cat -- "$path" 2>/dev/null || note "Unable to read log: $path"
    fi
  done
}

collect_webroots() {
  local roots_file="$CURRENT_STATE_DIR/webroots.txt"
  {
    if compgen -G "/etc/apache2/sites-enabled/*.conf" >/dev/null; then
      awk '
        /^[[:space:]]*DocumentRoot[[:space:]]+/ {
          gsub(/"/, "", $2)
          print $2
        }
      ' /etc/apache2/sites-enabled/*.conf 2>/dev/null
    fi
    if ((${#EXTRA_WEBROOTS[@]} > 0)); then
      printf '%s\n' "${EXTRA_WEBROOTS[@]}"
    fi
  } | awk 'NF' | sort -u | while IFS= read -r path; do
    [[ -d "$path" ]] && printf '%s\n' "$path"
  done | sort -u > "$roots_file"
}

collect_ports() {
  local out="$CURRENT_STATE_DIR/ports.tsv"
  if ! command_exists ss; then
    note "ss not available; skipping listening port snapshot"
    : > "$out"
    return
  fi

  ss -H -lntu 2>/dev/null | awk '
    {
      proto=$1
      local=$5
      address=local
      port=local
      sub(/:[^:]*$/, "", address)
      sub(/^.*:/, "", port)
      gsub(/^\[/, "", address)
      gsub(/\]$/, "", address)
      print proto "\t" address "\t" port
    }
  ' | sort -u > "$out"
}

collect_services() {
  local enabled_out="$CURRENT_STATE_DIR/enabled_services.tsv"
  local running_out="$CURRENT_STATE_DIR/running_services.tsv"
  local failed_out="$CURRENT_STATE_DIR/failed_services.tsv"

  if ! command_exists systemctl; then
    note "systemctl not available; skipping service snapshots"
    : > "$enabled_out"
    : > "$running_out"
    : > "$failed_out"
    return
  fi

  systemctl list-unit-files --type=service --no-legend --no-pager 2>/dev/null \
    | awk '$2 ~ /^enabled/ {print $1 "\t" $2}' | sort -u > "$enabled_out" || : > "$enabled_out"

  systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null \
    | awk '{print $1 "\t" $4}' | sort -u > "$running_out" || : > "$running_out"

  systemctl list-units --type=service --state=failed --no-legend --no-pager 2>/dev/null \
    | awk '{print $1 "\t" $4}' | sort -u > "$failed_out" || : > "$failed_out"
}

collect_packages() {
  local out="$CURRENT_STATE_DIR/packages.tsv"
  if ! command_exists dpkg-query; then
    note "dpkg-query not available; skipping package snapshot"
    : > "$out"
    return
  fi

  dpkg-query -W -f='${Package}\t${Version}\n' 2>/dev/null | sort -u > "$out"
}

collect_users() {
  local users_out="$CURRENT_STATE_DIR/users.tsv"
  local groups_out="$CURRENT_STATE_DIR/user_groups.tsv"

  getent passwd | awk -F: '{print $1 "\t" $3 "\t" $4 "\t" $6 "\t" $7}' | sort -u > "$users_out"

  : > "$groups_out"
  while IFS=: read -r user _ uid _ _ _ shell; do
    local groups
    groups="$(id -nG "$user" 2>/dev/null | tr ' ' ',' || true)"
    printf '%s\t%s\t%s\t%s\n' "$user" "$uid" "$shell" "$groups" >> "$groups_out"
  done < <(getent passwd)
  sort -u "$groups_out" -o "$groups_out"
}

hash_one_path() {
  local path="$1"
  local sum mode owner group size mtime
  sum="$(sha256sum -- "$path" 2>/dev/null | awk '{print $1}')" || {
    note "Unable to hash $path"
    return
  }
  mode="$(stat -c '%a' -- "$path" 2>/dev/null || printf '?')"
  owner="$(stat -c '%U' -- "$path" 2>/dev/null || printf '?')"
  group="$(stat -c '%G' -- "$path" 2>/dev/null || printf '?')"
  size="$(stat -c '%s' -- "$path" 2>/dev/null || printf '?')"
  mtime="$(stat -c '%Y' -- "$path" 2>/dev/null || printf '?')"
  printf '%s\t%s\t%s\t%s:%s\t%s\t%s\n' "$path" "$sum" "$mode" "$owner" "$group" "$size" "$mtime"
}

collect_config_hashes() {
  local out="$CURRENT_STATE_DIR/config_hashes.tsv"
  local path
  : > "$out"
  for path in "${CONFIG_HASH_PATHS[@]}"; do
    if [[ -d "$path" ]]; then
      while IFS= read -r file; do
        hash_one_path "$file" >> "$out"
      done < <(({ find "$path" -xdev \( -type f -o -type l \) 2>/dev/null || true; } | filter_regex "$SENSITIVE_EXCLUDE_REGEX" | sort))
    elif [[ -f "$path" || -L "$path" ]]; then
      hash_one_path "$path" >> "$out"
    fi
  done
  sorted_unique_copy "$out" "$out.sorted"
  mv "$out.sorted" "$out"
}

collect_sensitive_inventory() {
  local all_out="$CURRENT_STATE_DIR/sensitive_inventory.tsv"
  local recent_out="$CURRENT_STATE_DIR/sensitive_recent.tsv"
  local start_human
  start_human="$(date -d "@$WINDOW_START_EPOCH" '+%Y-%m-%d %H:%M:%S')"

  : > "$all_out"
  : > "$recent_out"

  local dir
  for dir in "${SENSITIVE_DIRS[@]}"; do
    [[ -e "$dir" ]] || continue
    { find "$dir" -xdev \( -type f -o -type l \) \
      -printf '%p\t%y\t%m\t%u\t%g\t%s\t%T@\n' 2>/dev/null || true; } \
      | filter_regex "$SENSITIVE_EXCLUDE_REGEX" >> "$all_out"

    { find "$dir" -xdev \( -type f -o -type l \) -newermt "$start_human" \
      -printf '%p\t%TY-%Tm-%Td %TH:%TM:%TS\t%m\t%u\t%g\t%s\n' 2>/dev/null || true; } \
      | filter_regex "$SENSITIVE_EXCLUDE_REGEX" >> "$recent_out"
  done

  sorted_unique_copy "$all_out" "$all_out.sorted"
  mv "$all_out.sorted" "$all_out"
  sorted_unique_copy "$recent_out" "$recent_out.sorted"
  mv "$recent_out.sorted" "$recent_out"
}

collect_webroot_indicators() {
  local suspicious_out="$CURRENT_STATE_DIR/webroot_suspicious.tsv"
  local perm_out="$CURRENT_STATE_DIR/webroot_permission_flags.tsv"
  local start_human
  start_human="$(date -d "@$WINDOW_START_EPOCH" '+%Y-%m-%d %H:%M:%S')"

  : > "$suspicious_out"
  : > "$perm_out"

  while IFS= read -r root; do
    [[ -d "$root" ]] || continue

    while IFS= read -r file; do
      [[ -n "$file" ]] || continue
      [[ "$file" =~ $WEBROOT_EXCLUDE_REGEX ]] && continue
      local base mode size mtime category
      base="$(basename "$file")"
      mode="$(stat -c '%a' -- "$file" 2>/dev/null || printf '?')"
      size="$(stat -c '%s' -- "$file" 2>/dev/null || printf '?')"
      mtime="$(stat -c '%y' -- "$file" 2>/dev/null || printf '?')"
      category=""

      case "$file" in
        */uploads/*|*/wp-content/uploads/*|*/cache/*|*/tmp/*)
          case "$file" in
            *.php|*.phtml|*.phar|*.sh|*.cgi|*.pl|*.py)
              category="script-in-upload-or-cache"
              ;;
          esac
          ;;
      esac

      if [[ -z "$category" && "$base" == .* && "$base" != ".htaccess" && "$base" != ".well-known" && "$base" != ".gitkeep" ]]; then
        category="hidden-file"
      fi

      if [[ -z "$category" && -x "$file" ]]; then
        case "$file" in
          *.php|*.phtml|*.phar|*.sh|*.cgi|*.pl|*.py)
            category="executable-script"
            ;;
        esac
      fi

      if [[ -n "$category" ]]; then
        printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$root" "$category" "$file" "$mode" "$size" "$mtime" >> "$suspicious_out"
      fi
    done < <({ find "$root" -xdev -type f -newermt "$start_human" 2>/dev/null || true; })

    { find "$root" -xdev -type f \
      \( -iname '*.php' -o -iname '*.phtml' -o -iname '*.phar' -o -iname '*.sh' -o -iname '*.cgi' -o -iname '*.pl' -o -iname '*.py' \) \
      -perm -0002 -printf '%p\t%m\t%u\t%g\t%s\t%TY-%Tm-%Td %TH:%TM:%TS\n' 2>/dev/null || true; } \
      | filter_regex "$WEBROOT_EXCLUDE_REGEX" \
      | awk -v root="$root" -F'\t' '{print root "\tworld-writable-script\t" $0}' >> "$perm_out"
  done < "$CURRENT_STATE_DIR/webroots.txt"

  sorted_unique_copy "$suspicious_out" "$suspicious_out.sorted"
  mv "$suspicious_out.sorted" "$suspicious_out"
  sorted_unique_copy "$perm_out" "$perm_out.sorted"
  mv "$perm_out.sorted" "$perm_out"
}

collect_disk_state() {
  local df_out="$CURRENT_STATE_DIR/disk_df.tsv"
  local du_out="$CURRENT_STATE_DIR/disk_du.tsv"

  df -Pk 2>/dev/null | awk 'NR > 1 {gsub(/%/, "", $5); print $6 "\t" $2 "\t" $3 "\t" $4 "\t" $5}' | sort -u > "$df_out"

  : > "$du_out"
  local path
  for path in / /var /var/log /var/public /home /tmp; do
    [[ -e "$path" ]] || continue
    du -sk "$path" 2>/dev/null | awk -v p="$path" '{print p "\t" $1}' >> "$du_out" || true
  done
  sort -u "$du_out" -o "$du_out"
}

collect_auth_window() {
  local failed_out="$CURRENT_STATE_DIR/auth_ssh_failed.log"
  local success_out="$CURRENT_STATE_DIR/auth_ssh_success.log"
  local sudo_out="$CURRENT_STATE_DIR/auth_sudo.log"
  local auth_misc_out="$CURRENT_STATE_DIR/auth_misc.log"
  : > "$failed_out"
  : > "$success_out"
  : > "$sudo_out"
  : > "$auth_misc_out"

  if command_exists journalctl; then
    journalctl --since "@$WINDOW_START_EPOCH" --until "@$NOW_EPOCH" --no-pager -o short-iso _COMM=sshd 2>/dev/null \
      | tee "$CURRENT_STATE_DIR/auth_sshd_all.log" >/dev/null || : > "$CURRENT_STATE_DIR/auth_sshd_all.log"

    grep -E 'Failed password|Invalid user|authentication failure' "$CURRENT_STATE_DIR/auth_sshd_all.log" > "$failed_out" || :
    grep -E 'Accepted [^ ]+ for ' "$CURRENT_STATE_DIR/auth_sshd_all.log" > "$success_out" || :
    grep -E 'root|PAM|authentication failure|session opened|session closed' "$CURRENT_STATE_DIR/auth_sshd_all.log" > "$auth_misc_out" || :

    journalctl --since "@$WINDOW_START_EPOCH" --until "@$NOW_EPOCH" --no-pager -o short-iso SYSLOG_IDENTIFIER=sudo 2>/dev/null > "$sudo_out" || :
  else
    note "journalctl not available; auth summary may be incomplete"
  fi
}

collect_package_window() {
  local dpkg_out="$CURRENT_STATE_DIR/package_dpkg_window.log"
  local apt_out="$CURRENT_STATE_DIR/package_apt_window.log"
  local start_stamp end_stamp
  start_stamp="$(date -d "@$WINDOW_START_EPOCH" '+%Y-%m-%d %H:%M:%S')"
  end_stamp="$(date -d "@$NOW_EPOCH" '+%Y-%m-%d %H:%M:%S')"

  read_text_bundle /var/log/dpkg.log /var/log/dpkg.log.1 /var/log/dpkg.log.2.gz /var/log/dpkg.log.3.gz \
    | awk -v start="$start_stamp" -v end="$end_stamp" '
        {
          stamp=$1 " " $2
          if (stamp >= start && stamp <= end && ($3 == "install" || $3 == "upgrade" || $3 == "remove" || $3 == "purge")) {
            print
          }
        }
      ' > "$dpkg_out"

  read_text_bundle /var/log/apt/history.log /var/log/apt/history.log.1 /var/log/apt/history.log.2.gz /var/log/apt/history.log.3.gz \
    | awk -v start="$start_stamp" -v end="$end_stamp" '
        /^Start-Date:/ {
          active=0
          block=$0 ORS
          stamp=$2 " " $3
          if (stamp >= start && stamp <= end) {
            active=1
          }
          next
        }
        active {
          if ($0 == "") {
            print block
            block=""
            active=0
          } else {
            block=block $0 ORS
          }
        }
      ' > "$apt_out"
}

collect_system_events() {
  local warn_out="$CURRENT_STATE_DIR/journal_warning.log"
  local reboot_out="$CURRENT_STATE_DIR/reboots_window.log"
  : > "$warn_out"
  : > "$reboot_out"

  if command_exists journalctl; then
    journalctl --since "@$WINDOW_START_EPOCH" --until "@$NOW_EPOCH" --no-pager -p warning..alert -o short-iso 2>/dev/null > "$warn_out" || :
  fi

  if command_exists last; then
    last -x -F -w 2>/dev/null | awk -v start="$WINDOW_START_EPOCH" '
      BEGIN {
        cmd = "date +%s"
      }
      /^reboot|^shutdown/ {print}
    ' > "$reboot_out" || :
  fi
}

latest_snapshot_dirs() {
  find "$STATE_DIR/snapshots" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort
}

prepare_history_context() {
  local -a snapshot_ids=()
  local id
  if [[ ! -d "$STATE_DIR/snapshots" ]]; then
    return
  fi

  while IFS= read -r id; do
    [[ -n "$id" ]] && snapshot_ids+=("$id")
  done < <(latest_snapshot_dirs)

  local -a prior_ids=()
  for id in "${snapshot_ids[@]}"; do
    [[ "$id" != "$RUN_ID" ]] && prior_ids+=("$id")
  done

  if ((${#prior_ids[@]} > 0)); then
    PREVIOUS_SNAPSHOT_DIR="$STATE_DIR/snapshots/${prior_ids[-1]}"
  fi

  local start_index=0
  if ((${#prior_ids[@]} > HISTORY_DAYS)); then
    start_index=$((${#prior_ids[@]} - HISTORY_DAYS))
  fi

  HISTORY_SNAPSHOT_DIRS=()
  for ((i = start_index; i < ${#prior_ids[@]}; i++)); do
    HISTORY_SNAPSHOT_DIRS+=("$STATE_DIR/snapshots/${prior_ids[$i]}")
  done
}

compare_set_files() {
  local previous="$1"
  local current="$2"
  local added="$3"
  local removed="$4"

  : > "$added"
  : > "$removed"

  [[ -f "$current" ]] || return
  if [[ ! -f "$previous" ]]; then
    cp "$current" "$added"
    return
  fi

  comm -13 <(sort "$previous") <(sort "$current") > "$added" || :
  comm -23 <(sort "$previous") <(sort "$current") > "$removed" || :
}

compare_hash_inventory() {
  local previous="$1"
  local current="$2"
  local out="$3"
  : > "$out"
  [[ -f "$current" ]] || return

  if [[ ! -f "$previous" ]]; then
    awk -F'\t' '{print "NEW\t" $1 "\t" $2 "\t"}' "$current" > "$out"
    return
  fi

  awk -F'\t' '
    FNR == NR {
      prev[$1] = $2
      prev_order[++prev_count] = $1
      next
    }
    {
      curr[$1] = $2
      if (!($1 in prev)) {
        print "NEW\t" $1 "\t" $2 "\t"
      } else if (prev[$1] != $2) {
        print "CHANGED\t" $1 "\t" $2 "\t" prev[$1]
      }
    }
    END {
      for (i = 1; i <= prev_count; i++) {
        key = prev_order[i]
        if (!(key in curr)) {
          print "REMOVED\t" key "\t\t" prev[key]
        }
      }
    }
  ' "$previous" "$current" | sort > "$out"
}

compare_keyed_inventory() {
  local previous="$1"
  local current="$2"
  local out="$3"
  : > "$out"
  [[ -f "$current" ]] || return

  if [[ ! -f "$previous" ]]; then
    awk -F'\t' '{print "NEW\t" $0}' "$current" > "$out"
    return
  fi

  awk -F'\t' '
    FNR == NR {
      prev[$1] = $0
      prev_order[++prev_count] = $1
      next
    }
    {
      curr[$1] = $0
      if (!($1 in prev)) {
        print "NEW\t" $0
      } else if (prev[$1] != $0) {
        print "CHANGED\t" $0 "\tPREVIOUS\t" prev[$1]
      }
    }
    END {
      for (i = 1; i <= prev_count; i++) {
        key = prev_order[i]
        if (!(key in curr)) {
          print "REMOVED\t" prev[key]
        }
      }
    }
  ' "$previous" "$current" | sort > "$out"
}

history_file_for() {
  local snapshot_dir="$1"
  local rel="$2"
  printf '%s/%s\n' "$snapshot_dir" "$rel"
}

line_seen_in_history() {
  local rel="$1"
  local target="$2"
  local snapshot
  for snapshot in "${HISTORY_SNAPSHOT_DIRS[@]}"; do
    [[ -f "$(history_file_for "$snapshot" "$rel")" ]] || continue
    if grep -Fqx -- "$target" "$(history_file_for "$snapshot" "$rel")"; then
      return 0
    fi
  done
  return 1
}

hash_seen_in_history() {
  local rel="$1"
  local path="$2"
  local hash="$3"
  local snapshot
  for snapshot in "${HISTORY_SNAPSHOT_DIRS[@]}"; do
    [[ -f "$(history_file_for "$snapshot" "$rel")" ]] || continue
    if awk -F'\t' -v p="$path" -v h="$hash" '$1 == p && $2 == h {found=1} END {exit found ? 0 : 1}' \
      "$(history_file_for "$snapshot" "$rel")"; then
      return 0
    fi
  done
  return 1
}

hash_stable_in_history() {
  local rel="$1"
  local path="$2"
  local expected_hash="$3"
  local seen=0
  local snapshot
  for snapshot in "${HISTORY_SNAPSHOT_DIRS[@]}"; do
    [[ -f "$(history_file_for "$snapshot" "$rel")" ]] || continue
    local value
    value="$(awk -F'\t' -v p="$path" '$1 == p {print $2; exit}' "$(history_file_for "$snapshot" "$rel")")"
    if [[ -n "$value" ]]; then
      seen=1
      [[ "$value" == "$expected_hash" ]] || return 1
    fi
  done
  [[ "$seen" -eq 1 ]]
}

load_summary_value() {
  local file="$1"
  local key="$2"
  awk -F= -v k="$key" '$1 == k {print $2}' "$file" 2>/dev/null | tail -n 1
}

history_metric_stats() {
  local key="$1"
  local values_file="$WORKDIR/${key}.history"
  : > "$values_file"
  local snapshot
  for snapshot in "${HISTORY_SNAPSHOT_DIRS[@]}"; do
    [[ -f "$snapshot/summary.env" ]] || continue
    local value
    value="$(load_summary_value "$snapshot/summary.env" "$key")"
    [[ "$value" =~ ^[0-9]+$ ]] && printf '%s\n' "$value" >> "$values_file"
  done

  if [[ ! -s "$values_file" ]]; then
    printf '0 0 0\n'
    return
  fi

  awk '
    {
      sum += $1
      if ($1 > max) {
        max = $1
      }
      count++
    }
    END {
      if (count == 0) {
        print "0 0 0"
      } else {
        printf "%d %.2f %d\n", count, sum / count, max
      }
    }
  ' "$values_file"
}

compare_current_to_history() {
  if [[ -n "$PREVIOUS_SNAPSHOT_DIR" ]]; then
    compare_set_files "$PREVIOUS_SNAPSHOT_DIR/ports.tsv" "$CURRENT_STATE_DIR/ports.tsv" \
      "$TMP_COMPARE_DIR/new_ports.tsv" "$TMP_COMPARE_DIR/removed_ports.tsv"

    compare_set_files "$PREVIOUS_SNAPSHOT_DIR/enabled_services.tsv" "$CURRENT_STATE_DIR/enabled_services.tsv" \
      "$TMP_COMPARE_DIR/new_enabled_services.tsv" "$TMP_COMPARE_DIR/removed_enabled_services.tsv"

    compare_set_files "$PREVIOUS_SNAPSHOT_DIR/packages.tsv" "$CURRENT_STATE_DIR/packages.tsv" \
      "$TMP_COMPARE_DIR/new_packages.tsv" "$TMP_COMPARE_DIR/removed_packages.tsv"

    compare_set_files "$PREVIOUS_SNAPSHOT_DIR/users.tsv" "$CURRENT_STATE_DIR/users.tsv" \
      "$TMP_COMPARE_DIR/new_users.tsv" "$TMP_COMPARE_DIR/removed_users.tsv"

    compare_keyed_inventory "$PREVIOUS_SNAPSHOT_DIR/user_groups.tsv" "$CURRENT_STATE_DIR/user_groups.tsv" \
      "$TMP_COMPARE_DIR/user_group_changes.tsv"

    compare_hash_inventory "$PREVIOUS_SNAPSHOT_DIR/config_hashes.tsv" "$CURRENT_STATE_DIR/config_hashes.tsv" \
      "$TMP_COMPARE_DIR/config_hash_changes.tsv"

    compare_keyed_inventory "$PREVIOUS_SNAPSHOT_DIR/sensitive_inventory.tsv" "$CURRENT_STATE_DIR/sensitive_inventory.tsv" \
      "$TMP_COMPARE_DIR/sensitive_inventory_changes.tsv"
  else
    : > "$TMP_COMPARE_DIR/new_ports.tsv"
    : > "$TMP_COMPARE_DIR/removed_ports.tsv"
    : > "$TMP_COMPARE_DIR/new_enabled_services.tsv"
    : > "$TMP_COMPARE_DIR/removed_enabled_services.tsv"
    : > "$TMP_COMPARE_DIR/new_packages.tsv"
    : > "$TMP_COMPARE_DIR/removed_packages.tsv"
    : > "$TMP_COMPARE_DIR/new_users.tsv"
    : > "$TMP_COMPARE_DIR/removed_users.tsv"
    : > "$TMP_COMPARE_DIR/user_group_changes.tsv"
    : > "$TMP_COMPARE_DIR/config_hash_changes.tsv"
    : > "$TMP_COMPARE_DIR/sensitive_inventory_changes.tsv"
  fi

  : > "$TMP_COMPARE_DIR/new_ports_5d.tsv"
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    if ! line_seen_in_history "ports.tsv" "$line"; then
      printf '%s\n' "$line" >> "$TMP_COMPARE_DIR/new_ports_5d.tsv"
    fi
  done < "$TMP_COMPARE_DIR/new_ports.tsv"

  : > "$TMP_COMPARE_DIR/new_enabled_services_5d.tsv"
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    if ! line_seen_in_history "enabled_services.tsv" "$line"; then
      printf '%s\n' "$line" >> "$TMP_COMPARE_DIR/new_enabled_services_5d.tsv"
    fi
  done < "$TMP_COMPARE_DIR/new_enabled_services.tsv"

  : > "$TMP_COMPARE_DIR/new_security_packages.tsv"
  awk -F'\t' -v regex="$SECURITY_SENSITIVE_PACKAGE_REGEX" '$1 ~ regex {print}' "$TMP_COMPARE_DIR/new_packages.tsv" > "$TMP_COMPARE_DIR/new_security_packages.tsv" || :

  : > "$TMP_COMPARE_DIR/stable_break_configs.tsv"
  awk -F'\t' '$1 == "CHANGED" {print $0}' "$TMP_COMPARE_DIR/config_hash_changes.tsv" \
    | while IFS=$'\t' read -r change_type path curr_hash prev_hash; do
        [[ -n "$path" ]] || continue
        if hash_stable_in_history "config_hashes.tsv" "$path" "$prev_hash"; then
          printf '%s\t%s\t%s\t%s\n' "$change_type" "$path" "$curr_hash" "$prev_hash" >> "$TMP_COMPARE_DIR/stable_break_configs.tsv"
        fi
      done

  : > "$TMP_COMPARE_DIR/cron_persistence_changes.tsv"
  awk -F'\t' '
    $2 ~ /^\/(etc\/cron|var\/spool\/cron|etc\/systemd\/system|lib\/systemd\/system)/ {print}
  ' "$TMP_COMPARE_DIR/config_hash_changes.tsv" > "$TMP_COMPARE_DIR/cron_persistence_changes.tsv" || :
}

analyze_counts() {
  FAILED_SSH_COUNT="$(count_file_lines "$CURRENT_STATE_DIR/auth_ssh_failed.log")"
  SUCCESS_SSH_COUNT="$(count_file_lines "$CURRENT_STATE_DIR/auth_ssh_success.log")"
  ROOT_LOGIN_ATTEMPT_COUNT="$(grep_count_or_zero 'for root|root from|user root' "$CURRENT_STATE_DIR/auth_sshd_all.log")"
  SUDO_EVENT_COUNT="$(count_file_lines "$CURRENT_STATE_DIR/auth_sudo.log")"
  PACKAGE_EVENT_COUNT="$(count_file_lines "$CURRENT_STATE_DIR/package_dpkg_window.log")"
  NEW_PACKAGE_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/new_packages.tsv")"
  NEW_SECURITY_PACKAGE_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/new_security_packages.tsv")"
  NEW_PORT_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/new_ports.tsv")"
  NEW_PORT_5D_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/new_ports_5d.tsv")"
  NEW_ENABLED_SERVICE_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/new_enabled_services.tsv")"
  NEW_ENABLED_SERVICE_5D_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/new_enabled_services_5d.tsv")"
  NEW_USER_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/new_users.tsv")"
  REMOVED_USER_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/removed_users.tsv")"
  USER_GROUP_CHANGE_COUNT="$(grep_count_or_zero '^CHANGED' "$TMP_COMPARE_DIR/user_group_changes.tsv")"
  CONFIG_CHANGE_COUNT="$(grep_count_or_zero '^(NEW|CHANGED|REMOVED)' "$TMP_COMPARE_DIR/config_hash_changes.tsv")"
  CONFIG_STABLE_BREAK_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/stable_break_configs.tsv")"
  CRON_OR_PERSISTENCE_CHANGE_COUNT="$(count_file_lines "$TMP_COMPARE_DIR/cron_persistence_changes.tsv")"
  SENSITIVE_RECENT_COUNT="$(count_file_lines "$CURRENT_STATE_DIR/sensitive_recent.tsv")"
  SENSITIVE_NEW_FILE_COUNT="$(grep_count_or_zero '^NEW' "$TMP_COMPARE_DIR/sensitive_inventory_changes.tsv")"
  SENSITIVE_REMOVED_FILE_COUNT="$(grep_count_or_zero '^REMOVED' "$TMP_COMPARE_DIR/sensitive_inventory_changes.tsv")"
  WEBROOT_SUSPICIOUS_COUNT="$(count_file_lines "$CURRENT_STATE_DIR/webroot_suspicious.tsv")"
  WEBROOT_PERMISSION_FLAG_COUNT="$(count_file_lines "$CURRENT_STATE_DIR/webroot_permission_flags.tsv")"
  FAILED_SERVICE_COUNT="$(count_file_lines "$CURRENT_STATE_DIR/failed_services.tsv")"
  JOURNAL_WARNING_COUNT="$(count_file_lines "$CURRENT_STATE_DIR/journal_warning.log")"
}

assess_disk_growth() {
  local current="$CURRENT_STATE_DIR/disk_du.tsv"
  local previous="$PREVIOUS_SNAPSHOT_DIR/disk_du.tsv"
  local out="$TMP_COMPARE_DIR/disk_growth.tsv"
  : > "$out"
  DISK_GROWTH_ALERT_COUNT=0

  [[ -f "$current" ]] || return 0
  [[ -f "$previous" ]] || return 0

  awk -F'\t' '
    FNR == NR {
      prev[$1] = $2
      next
    }
    {
      if ($1 in prev) {
        delta = $2 - prev[$1]
        pct = (prev[$1] > 0 ? (delta / prev[$1]) * 100 : 0)
        if (delta > 1048576 || pct >= 20) {
          printf "%s\t%d\t%d\t%.2f\n", $1, $2, prev[$1], pct
        }
      }
    }
  ' "$previous" "$current" > "$out"

  DISK_GROWTH_ALERT_COUNT="$(count_file_lines "$out")"
}

top_failed_ssh_ips() {
  grep -oE 'from ([0-9a-fA-F:.]+)' "$CURRENT_STATE_DIR/auth_ssh_failed.log" 2>/dev/null \
    | awk '{print $2}' | sort | uniq -c | sort -nr | sed 's/^ *//' | head -n 10 || true
}

top_successful_ssh_logins() {
  awk '
    match($0, /Accepted [^ ]+ for ([^ ]+) from ([^ ]+)/, m) {
      print m[1] "\t" m[2]
    }
  ' "$CURRENT_STATE_DIR/auth_ssh_success.log" 2>/dev/null | sort | uniq -c | sort -nr | sed 's/^ *//' | head -n 10 || true
}

top_sudo_users() {
  awk '
    match($0, /by ([^ (]+)\(uid=/, m) {print m[1]; next}
    match($0, /^.*sudo: *([^ :]+) :/, m) {print m[1]}
  ' "$CURRENT_STATE_DIR/auth_sudo.log" 2>/dev/null | awk 'NF' | sort | uniq -c | sort -nr | sed 's/^ *//' | head -n 10 || true
}

history_spike_text() {
  local key="$1"
  local current_value="$2"
  local label="$3"
  local stats count avg max
  stats="$(history_metric_stats "$key")"
  count="$(awk '{print $1}' <<<"$stats")"
  avg="$(awk '{print $2}' <<<"$stats")"
  max="$(awk '{print $3}' <<<"$stats")"
  if [[ "$count" == "0" ]]; then
    printf '%s: no prior baseline\n' "$label"
    return
  fi
  printf '%s: today=%s, 5-day avg=%s, 5-day max=%s\n' "$label" "$current_value" "$avg" "$max"
}

set_attention_level() {
  local risk="no major issues"
  if (( NEW_PORT_5D_COUNT > 0 || NEW_ENABLED_SERVICE_5D_COUNT > 0 || NEW_USER_COUNT > 0 || WEBROOT_SUSPICIOUS_COUNT > 0 || CONFIG_STABLE_BREAK_COUNT > 0 || CRON_OR_PERSISTENCE_CHANGE_COUNT > 0 || FAILED_SERVICE_COUNT > 0 )); then
    risk="suspicious activity detected"
  elif (( PACKAGE_EVENT_COUNT > 0 || NEW_PACKAGE_COUNT > 0 || CONFIG_CHANGE_COUNT > 0 || SENSITIVE_RECENT_COUNT > 0 || FAILED_SSH_COUNT > 0 || DISK_GROWTH_ALERT_COUNT > 0 )); then
    risk="review recommended"
  fi

  local stats avg count
  stats="$(history_metric_stats "FAILED_SSH_COUNT")"
  count="$(awk '{print $1}' <<<"$stats")"
  avg="$(awk '{print $2}' <<<"$stats")"
  if [[ "$count" != "0" ]]; then
    if awk -v curr="$FAILED_SSH_COUNT" -v mean="$avg" 'BEGIN {exit !(curr >= 20 && mean > 0 && curr >= mean * 2)}'; then
      risk="suspicious activity detected"
    fi
  fi

  ATTENTION_LEVEL="$risk"
}

write_summary_state() {
  cat > "$CURRENT_STATE_DIR/summary.env" <<EOF
RUN_ID=$RUN_ID
RUN_DATE=$RUN_DATE
WINDOW_START_EPOCH=$WINDOW_START_EPOCH
NOW_EPOCH=$NOW_EPOCH
FAILED_SSH_COUNT=$FAILED_SSH_COUNT
SUCCESS_SSH_COUNT=$SUCCESS_SSH_COUNT
ROOT_LOGIN_ATTEMPT_COUNT=$ROOT_LOGIN_ATTEMPT_COUNT
SUDO_EVENT_COUNT=$SUDO_EVENT_COUNT
PACKAGE_EVENT_COUNT=$PACKAGE_EVENT_COUNT
NEW_PACKAGE_COUNT=$NEW_PACKAGE_COUNT
NEW_SECURITY_PACKAGE_COUNT=$NEW_SECURITY_PACKAGE_COUNT
NEW_PORT_COUNT=$NEW_PORT_COUNT
NEW_PORT_5D_COUNT=$NEW_PORT_5D_COUNT
NEW_ENABLED_SERVICE_COUNT=$NEW_ENABLED_SERVICE_COUNT
NEW_ENABLED_SERVICE_5D_COUNT=$NEW_ENABLED_SERVICE_5D_COUNT
NEW_USER_COUNT=$NEW_USER_COUNT
REMOVED_USER_COUNT=$REMOVED_USER_COUNT
USER_GROUP_CHANGE_COUNT=$USER_GROUP_CHANGE_COUNT
CONFIG_CHANGE_COUNT=$CONFIG_CHANGE_COUNT
CONFIG_STABLE_BREAK_COUNT=$CONFIG_STABLE_BREAK_COUNT
CRON_OR_PERSISTENCE_CHANGE_COUNT=$CRON_OR_PERSISTENCE_CHANGE_COUNT
SENSITIVE_RECENT_COUNT=$SENSITIVE_RECENT_COUNT
SENSITIVE_NEW_FILE_COUNT=$SENSITIVE_NEW_FILE_COUNT
SENSITIVE_REMOVED_FILE_COUNT=$SENSITIVE_REMOVED_FILE_COUNT
WEBROOT_SUSPICIOUS_COUNT=$WEBROOT_SUSPICIOUS_COUNT
WEBROOT_PERMISSION_FLAG_COUNT=$WEBROOT_PERMISSION_FLAG_COUNT
FAILED_SERVICE_COUNT=$FAILED_SERVICE_COUNT
JOURNAL_WARNING_COUNT=$JOURNAL_WARNING_COUNT
DISK_GROWTH_ALERT_COUNT=$DISK_GROWTH_ALERT_COUNT
EOF
}

format_df_change_table() {
  local current="$CURRENT_STATE_DIR/disk_df.tsv"
  local previous="$PREVIOUS_SNAPSHOT_DIR/disk_df.tsv"
  local out="$TMP_COMPARE_DIR/disk_df_changes.tsv"
  : > "$out"
  [[ -f "$current" && -f "$previous" ]] || return 0

  awk -F'\t' '
    FNR == NR {
      prev[$1] = $0
      next
    }
    {
      if ($1 in prev) {
        split(prev[$1], p, FS)
        used_delta = $3 - p[3]
        pct_delta = $5 - p[5]
        if (used_delta != 0 || pct_delta != 0) {
          printf "%s\t%s\t%s\t%s\t%s\t%d\t%d\n", $1, $2, $3, $4, $5, used_delta, pct_delta
        }
      }
    }
  ' "$previous" "$current" > "$out"
}

render_report() {
  CURRENT_REPORT="$REPORT_DIR/${RUN_ID}.txt"
  local critical_file="$WORKDIR/critical_summary.txt"
  local notable_file="$WORKDIR/notable_summary.txt"
  local baseline_file="$WORKDIR/baseline_summary.txt"
  : > "$critical_file"
  : > "$notable_file"
  : > "$baseline_file"

  (( NEW_PORT_5D_COUNT > 0 )) && printf -- '- %s new listening port entries were not seen in the prior %s days.\n' "$NEW_PORT_5D_COUNT" "$HISTORY_DAYS" >> "$critical_file"
  (( NEW_ENABLED_SERVICE_5D_COUNT > 0 )) && printf -- '- %s enabled services were not seen in the prior %s days.\n' "$NEW_ENABLED_SERVICE_5D_COUNT" "$HISTORY_DAYS" >> "$critical_file"
  (( CONFIG_STABLE_BREAK_COUNT > 0 )) && printf -- '- %s important config files changed after being stable across the recent baseline.\n' "$CONFIG_STABLE_BREAK_COUNT" >> "$critical_file"
  (( CRON_OR_PERSISTENCE_CHANGE_COUNT > 0 )) && printf -- '- %s cron or persistence-related config changes were detected.\n' "$CRON_OR_PERSISTENCE_CHANGE_COUNT" >> "$critical_file"
  (( NEW_USER_COUNT > 0 )) && printf -- '- %s new user accounts appeared since the last snapshot.\n' "$NEW_USER_COUNT" >> "$critical_file"
  (( WEBROOT_SUSPICIOUS_COUNT > 0 )) && printf -- '- %s suspicious webroot file indicators were found in the last 24 hours.\n' "$WEBROOT_SUSPICIOUS_COUNT" >> "$critical_file"
  (( FAILED_SERVICE_COUNT > 0 )) && printf -- '- %s systemd services are currently failed.\n' "$FAILED_SERVICE_COUNT" >> "$critical_file"

  (( PACKAGE_EVENT_COUNT > 0 )) && printf -- '- %s package events occurred in the last 24 hours.\n' "$PACKAGE_EVENT_COUNT" >> "$notable_file"
  (( NEW_PACKAGE_COUNT > 0 )) && printf -- '- %s packages are new relative to the last snapshot.\n' "$NEW_PACKAGE_COUNT" >> "$notable_file"
  (( CONFIG_CHANGE_COUNT > 0 )) && printf -- '- %s tracked config files changed, were added, or were removed.\n' "$CONFIG_CHANGE_COUNT" >> "$notable_file"
  (( SENSITIVE_RECENT_COUNT > 0 )) && printf -- '- %s files in sensitive system paths changed in the last 24 hours.\n' "$SENSITIVE_RECENT_COUNT" >> "$notable_file"
  (( FAILED_SSH_COUNT > 0 )) && printf -- '- %s failed SSH authentication events were logged.\n' "$FAILED_SSH_COUNT" >> "$notable_file"
  (( DISK_GROWTH_ALERT_COUNT > 0 )) && printf -- '- %s tracked paths grew sharply relative to the prior snapshot.\n' "$DISK_GROWTH_ALERT_COUNT" >> "$notable_file"

  history_spike_text "FAILED_SSH_COUNT" "$FAILED_SSH_COUNT" "Failed SSH activity" >> "$baseline_file"
  history_spike_text "SENSITIVE_RECENT_COUNT" "$SENSITIVE_RECENT_COUNT" "Sensitive path change volume" >> "$baseline_file"
  history_spike_text "PACKAGE_EVENT_COUNT" "$PACKAGE_EVENT_COUNT" "Package change volume" >> "$baseline_file"
  history_spike_text "WEBROOT_SUSPICIOUS_COUNT" "$WEBROOT_SUSPICIOUS_COUNT" "Webroot suspicious indicators" >> "$baseline_file"

  format_df_change_table

  {
    printf 'Section 1: Executive Summary\n'
    printf 'Generated: %s\n' "$NOW_ISO"
    printf 'Window: %s to %s\n' "$WINDOW_START_ISO" "$NOW_ISO"
  printf 'Snapshot ID: %s\n' "$RUN_ID"
  printf 'Previous snapshot: %s\n' "${PREVIOUS_SNAPSHOT_DIR:-none}"
  printf 'Historical baseline: up to %s prior daily snapshots\n' "$HISTORY_DAYS"
  printf 'Overall attention: %s\n' "$ATTENTION_LEVEL"
  if [[ -z "$PREVIOUS_SNAPSHOT_DIR" ]]; then
    printf 'Baseline status: initial baseline capture; change deltas start on the next run\n'
  fi
  printf '\n'
    printf 'Critical or suspicious findings:\n'
    tail_limit "$critical_file" 12
    printf '\n'
    printf 'Notable changes today:\n'
    tail_limit "$notable_file" 12
    printf '\n'
    printf 'Baseline comparison:\n'
    tail_limit "$baseline_file" 12
    printf '\n'

    printf 'Section 2: Authentication Summary\n'
    printf 'Failed SSH events: %s\n' "$FAILED_SSH_COUNT"
    printf 'Successful SSH logins: %s\n' "$SUCCESS_SSH_COUNT"
    printf 'Root login attempts or root-related SSH events: %s\n' "$ROOT_LOGIN_ATTEMPT_COUNT"
    printf 'sudo events: %s\n' "$SUDO_EVENT_COUNT"
    printf 'Top failed SSH source IPs:\n'
    top_failed_ssh_ips
    printf '\n'
    printf 'Top successful SSH logins:\n'
    top_successful_ssh_logins
    printf '\n'
    printf 'Top sudo users:\n'
    top_sudo_users
    printf '\n'
    printf 'Recent failed SSH lines:\n'
    tail_limit "$CURRENT_STATE_DIR/auth_ssh_failed.log" 15
    printf '\n'

    printf 'Section 3: User / Privilege Changes\n'
    printf 'New users since previous snapshot: %s\n' "$NEW_USER_COUNT"
    printf 'Removed users since previous snapshot: %s\n' "$REMOVED_USER_COUNT"
    printf 'User group membership changes: %s\n' "$USER_GROUP_CHANGE_COUNT"
    printf 'New users:\n'
    tail_limit "$TMP_COMPARE_DIR/new_users.tsv" 20
    printf '\n'
    printf 'Removed users:\n'
    tail_limit "$TMP_COMPARE_DIR/removed_users.tsv" 20
    printf '\n'
    printf 'Group membership changes:\n'
    tail_limit "$TMP_COMPARE_DIR/user_group_changes.tsv" 20
    printf '\n'

    printf 'Section 4: Package Changes\n'
    printf 'dpkg events in last 24h: %s\n' "$PACKAGE_EVENT_COUNT"
    printf 'New packages since previous snapshot: %s\n' "$NEW_PACKAGE_COUNT"
    printf 'New security-sensitive package matches: %s\n' "$NEW_SECURITY_PACKAGE_COUNT"
    printf 'Recent dpkg activity:\n'
    tail_limit "$CURRENT_STATE_DIR/package_dpkg_window.log" 25
    printf '\n'
    printf 'Recent apt transactions:\n'
    tail_limit "$CURRENT_STATE_DIR/package_apt_window.log" 25
    printf '\n'
    printf 'New packages since previous snapshot:\n'
    tail_limit "$TMP_COMPARE_DIR/new_packages.tsv" 25
    printf '\n'
    printf 'Security-sensitive package additions:\n'
    tail_limit "$TMP_COMPARE_DIR/new_security_packages.tsv" 25
    printf '\n'

    printf 'Section 5: Service / Port Changes\n'
    printf 'Failed services currently present: %s\n' "$FAILED_SERVICE_COUNT"
    printf 'New listening ports since previous snapshot: %s\n' "$NEW_PORT_COUNT"
    printf 'New listening ports not seen in the prior %s days: %s\n' "$HISTORY_DAYS" "$NEW_PORT_5D_COUNT"
    printf 'New enabled services since previous snapshot: %s\n' "$NEW_ENABLED_SERVICE_COUNT"
    printf 'New enabled services not seen in the prior %s days: %s\n' "$HISTORY_DAYS" "$NEW_ENABLED_SERVICE_5D_COUNT"
    printf 'Current failed services:\n'
    tail_limit "$CURRENT_STATE_DIR/failed_services.tsv" 20
    printf '\n'
    printf 'New listening ports:\n'
    tail_limit "$TMP_COMPARE_DIR/new_ports.tsv" 20
    printf '\n'
    printf 'Ports absent from last %s days:\n' "$HISTORY_DAYS"
    tail_limit "$TMP_COMPARE_DIR/new_ports_5d.tsv" 20
    printf '\n'
    printf 'New enabled services:\n'
    tail_limit "$TMP_COMPARE_DIR/new_enabled_services.tsv" 20
    printf '\n'
    printf 'Enabled services absent from last %s days:\n' "$HISTORY_DAYS"
    tail_limit "$TMP_COMPARE_DIR/new_enabled_services_5d.tsv" 20
    printf '\n'

    printf 'Section 6: Sensitive File and Config Changes\n'
    printf 'Sensitive files changed in the last 24h: %s\n' "$SENSITIVE_RECENT_COUNT"
    printf 'Sensitive files newly present since previous snapshot: %s\n' "$SENSITIVE_NEW_FILE_COUNT"
    printf 'Sensitive files removed since previous snapshot: %s\n' "$SENSITIVE_REMOVED_FILE_COUNT"
    printf 'Tracked config changes: %s\n' "$CONFIG_CHANGE_COUNT"
    printf 'Tracked config changes that broke a stable baseline: %s\n' "$CONFIG_STABLE_BREAK_COUNT"
    printf 'Cron/persistence-related config changes: %s\n' "$CRON_OR_PERSISTENCE_CHANGE_COUNT"
    printf 'Recent sensitive file changes:\n'
    tail_limit "$CURRENT_STATE_DIR/sensitive_recent.tsv" 40
    printf '\n'
    printf 'Tracked config hash changes:\n'
    tail_limit "$TMP_COMPARE_DIR/config_hash_changes.tsv" 40
    printf '\n'
    printf 'Stable baseline config breaks:\n'
    tail_limit "$TMP_COMPARE_DIR/stable_break_configs.tsv" 40
    printf '\n'
    printf 'Cron and persistence changes:\n'
    tail_limit "$TMP_COMPARE_DIR/cron_persistence_changes.tsv" 40
    printf '\n'

    printf 'Section 7: Webroot Suspicious File Indicators\n'
    printf 'Detected webroots: %s\n' "$(count_file_lines "$CURRENT_STATE_DIR/webroots.txt")"
    printf 'Suspicious indicators in last 24h: %s\n' "$WEBROOT_SUSPICIOUS_COUNT"
    printf 'Current world-writable script flags in webroots: %s\n' "$WEBROOT_PERMISSION_FLAG_COUNT"
    printf 'Recent suspicious webroot indicators:\n'
    tail_limit "$CURRENT_STATE_DIR/webroot_suspicious.tsv" 40
    printf '\n'
    printf 'Current world-writable script flags:\n'
    tail_limit "$CURRENT_STATE_DIR/webroot_permission_flags.tsv" 40
    printf '\n'

    printf 'Section 8: Disk / System Health\n'
    printf 'Journal warning-or-higher events in last 24h: %s\n' "$JOURNAL_WARNING_COUNT"
    printf 'Paths with sharp disk growth versus previous snapshot: %s\n' "$DISK_GROWTH_ALERT_COUNT"
    printf 'Filesystem usage snapshot:\n'
    tail_limit "$CURRENT_STATE_DIR/disk_df.tsv" 30
    printf '\n'
    printf 'Tracked path sizes:\n'
    tail_limit "$CURRENT_STATE_DIR/disk_du.tsv" 30
    printf '\n'
    printf 'Filesystem usage changes:\n'
    tail_limit "$TMP_COMPARE_DIR/disk_df_changes.tsv" 30
    printf '\n'
    printf 'Tracked path growth alerts:\n'
    tail_limit "$TMP_COMPARE_DIR/disk_growth.tsv" 30
    printf '\n'
    printf 'Recent journal warnings:\n'
    tail_limit "$CURRENT_STATE_DIR/journal_warning.log" 30
    printf '\n'

    printf 'Section 9: Comparison With Prior %s Days\n' "$HISTORY_DAYS"
    printf '%s' "$(history_spike_text "FAILED_SSH_COUNT" "$FAILED_SSH_COUNT" "Failed SSH activity")"
    printf '%s' "$(history_spike_text "SENSITIVE_RECENT_COUNT" "$SENSITIVE_RECENT_COUNT" "Sensitive path change volume")"
    printf '%s' "$(history_spike_text "PACKAGE_EVENT_COUNT" "$PACKAGE_EVENT_COUNT" "Package change volume")"
    printf '%s' "$(history_spike_text "WEBROOT_SUSPICIOUS_COUNT" "$WEBROOT_SUSPICIOUS_COUNT" "Webroot suspicious indicators")"
    printf '%s' "$(history_spike_text "NEW_PORT_COUNT" "$NEW_PORT_COUNT" "New listening port count")"
    printf '\n'

    printf 'Section 10: Raw Supporting Details\n'
    printf 'Detected webroots:\n'
    tail_limit "$CURRENT_STATE_DIR/webroots.txt" 50
    printf '\n'
    printf 'Current listening ports:\n'
    tail_limit "$CURRENT_STATE_DIR/ports.tsv" 50
    printf '\n'
    printf 'Enabled services:\n'
    tail_limit "$CURRENT_STATE_DIR/enabled_services.tsv" 50
    printf '\n'
    printf 'Running services:\n'
    tail_limit "$CURRENT_STATE_DIR/running_services.tsv" 50
    printf '\n'
    printf 'Notes and blind spots encountered during collection:\n'
    tail_limit "$NOTES_FILE" 50
  } > "$CURRENT_REPORT"
}

finalize_state() {
  local final_state_dir="$STATE_DIR/snapshots/$RUN_ID"
  mv "$CURRENT_STATE_DIR" "$final_state_dir"
  CURRENT_STATE_DIR="$final_state_dir"
}

maybe_prune() {
  (( ENABLE_PRUNE == 1 )) || return 0

  find "$REPORT_DIR" -maxdepth 1 -type f -name '*.txt' -mtime +"$REPORT_RETENTION_DAYS" -delete 2>/dev/null || true
  find "$STATE_DIR/snapshots" -mindepth 1 -maxdepth 1 -type d -mtime +"$STATE_RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true
}

main() {
  ensure_dirs
  prepare_history_context
  collect_webroots
  collect_ports
  collect_services
  collect_packages
  collect_users
  collect_config_hashes
  collect_sensitive_inventory
  collect_webroot_indicators
  collect_disk_state
  collect_auth_window
  collect_package_window
  collect_system_events
  compare_current_to_history
  analyze_counts
  assess_disk_growth
  set_attention_level
  write_summary_state
  render_report
  finalize_state
  maybe_prune
  printf 'Report written: %s\nState written: %s\n' "$CURRENT_REPORT" "$CURRENT_STATE_DIR"
}

main "$@"
