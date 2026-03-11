# Server Security Audit Reporting

This adds a passive, Bash-based daily audit report for Ubuntu production servers.

It is designed for:

- Apache plus multiple WordPress sites
- Next.js / Node.js apps
- daily visibility and drift detection
- 24-hour reporting with 5-day comparison context

It does not:

- block traffic
- restart services
- quarantine files
- delete anything by default
- enforce lockdowns automatically

## Files

- Script: `scripts/security-audit-report.sh`
- Example config: `scripts/security-audit.conf.example`

## Recommended directory structure

Use an external storage path so reports and state do not depend on the app repo:

```text
/var/local/server-audit/
  reports/
    2026-03-08_021500.txt
  state/
    snapshots/
      2026-03-03_021500/
      2026-03-04_021500/
      2026-03-05_021500/
      2026-03-06_021500/
      2026-03-07_021500/
      2026-03-08_021500/
```

Each snapshot stores machine-readable state:

- listening ports
- enabled/running services
- package inventory
- user and group state
- tracked config hashes
- sensitive file metadata inventory
- webroot suspicious indicators
- disk usage snapshots
- last-24-hour auth/package/journal extracts
- a small `summary.env` for baseline calculations

## How the 5-day comparison works

The script stores one dated snapshot per run. On each new run it:

1. Collects current state and last-24-hour events.
2. Compares current state against the most recent prior snapshot.
3. Loads up to 5 previous `summary.env` files to compute recent averages and maxima.
4. Checks whether new items were seen at all in the prior 5 snapshots.
5. Flags changes that broke a previously stable config hash baseline.

This lets the report say things like:

- new listening port since yesterday
- new listening port not seen in the last 5 days
- this SSH or Apache config changed today after staying stable
- failed SSH logins are much higher than the 5-day average
- package or sensitive-path change volume is abnormal relative to recent days

## Data sources used

The script prefers standard Ubuntu tooling:

- `journalctl` for auth, sudo, and warning-level system events
- `ss` for listening sockets
- `systemctl` for enabled/running/failed services
- `dpkg-query` plus `dpkg.log*` and `apt/history.log*`
- `getent`, `id`
- `find`, `stat`, `sha256sum`
- `df`, `du`
- Apache vhost config parsing from `/etc/apache2/sites-enabled/*.conf`

If a source is unreadable or unavailable, the script records that in the report notes instead of failing hard.

## Installation

Recommended for a live production server:

1. Review the script locally first:
   ```bash
   bash -n /var/public/otsukadetailer/detailer/web/scripts/security-audit-report.sh
   ```
2. Copy the example config:
   ```bash
   sudo install -m 0640 /var/public/otsukadetailer/detailer/web/scripts/security-audit.conf.example /etc/server-audit-report.conf
   ```
3. Edit `/etc/server-audit-report.conf` and confirm:
   - output directories
   - extra webroots not defined in Apache
   - any local exclusions that reduce noise
4. Install the script to an admin path:
   ```bash
   sudo install -m 0750 /var/public/otsukadetailer/detailer/web/scripts/security-audit-report.sh /usr/local/sbin/security-audit-report.sh
   ```
5. Create the storage directories:
   ```bash
   sudo mkdir -p /var/local/server-audit/reports /var/local/server-audit/state/snapshots
   sudo chmod 0750 /var/local/server-audit /var/local/server-audit/reports /var/local/server-audit/state /var/local/server-audit/state/snapshots
   ```

Run it as `root` for complete visibility into auth logs, package history, sudoers, and system configs.

## Cron entry

Example daily cron at 2:15 AM:

```cron
15 2 * * * /usr/local/sbin/security-audit-report.sh --config /etc/server-audit-report.conf >/dev/null 2>&1
```

This is intentionally plain cron. No daemon or extra service is required.

## Safe testing on a live server

Use this sequence:

1. Syntax check:
   ```bash
   bash -n /usr/local/sbin/security-audit-report.sh
   ```
2. Run once manually during a quiet window:
   ```bash
   sudo /usr/local/sbin/security-audit-report.sh --config /etc/server-audit-report.conf
   ```
3. Open the new report:
   ```bash
   sudo less /var/local/server-audit/reports/$(ls -1 /var/local/server-audit/reports | tail -n 1)
   ```
4. Verify the report is readable and the snapshot directory exists.
5. Run it again the next day to validate comparison sections.

This script is read-heavy only. It should not create downtime or change service state.

## Sample output

### Summary excerpt

```text
Section 1: Executive Summary
Generated: 2026-03-08 02:15:01 +0800
Window: 2026-03-07 02:15:01 +0800 to 2026-03-08 02:15:01 +0800
Snapshot ID: 2026-03-08_021501
Previous snapshot: /var/local/server-audit/state/snapshots/2026-03-07_021500
Historical baseline: up to 5 prior daily snapshots
Overall attention: review recommended

Critical or suspicious findings:
- 1 important config files changed after being stable across the recent baseline.
- 2 suspicious webroot file indicators were found in the last 24 hours.

Notable changes today:
- 4 package events occurred in the last 24 hours.
- 17 files in sensitive system paths changed in the last 24 hours.
- 8 failed SSH authentication events were logged.

Baseline comparison:
Failed SSH activity: today=8, 5-day avg=2.20, 5-day max=5
Sensitive path change volume: today=17, 5-day avg=5.40, 5-day max=9
Package change volume: today=4, 5-day avg=0.40, 5-day max=1
Webroot suspicious indicators: today=2, 5-day avg=0.00, 5-day max=0
```

### Detailed excerpt

```text
Section 5: Service / Port Changes
Failed services currently present: 0
New listening ports since previous snapshot: 1
New listening ports not seen in the prior 5 days: 1
New enabled services since previous snapshot: 0
New enabled services not seen in the prior 5 days: 0

New listening ports:
tcp    0.0.0.0    8443

Section 6: Sensitive File and Config Changes
Sensitive files changed in the last 24h: 17
Sensitive files newly present since previous snapshot: 2
Sensitive files removed since previous snapshot: 0
Tracked config changes: 3
Tracked config changes that broke a stable baseline: 1

Stable baseline config breaks:
CHANGED /etc/ssh/sshd_config d41... 9d9...
```

## Retention recommendation

- Reports: keep 90 days
- State snapshots: keep 30 days minimum

Do not auto-prune initially. Review storage growth first. The script supports pruning only if you explicitly set `ENABLE_PRUNE=1`.

## Limitations and blind spots

- It is not EDR, IDS, or antivirus.
- It does not inspect file contents for malware.
- It depends on readable logs and snapshots. If logs were tampered with before the run, the report may miss that history.
- It does not perform external attack-surface scanning from outside the server.
- It does not capture kernel-level stealth techniques or memory-only persistence.
- It focuses on practical change visibility, not perfect intrusion detection.

## Safe hardening recommendations

### Safe to apply now

- Move the daily script to `/usr/local/sbin` and run it via root cron for complete visibility.
- Keep the report/state storage outside webroots.
- Restrict permissions on the report/state directories to admins only.
- Rotate obvious secrets or credentials already known to have been exposed.
- Remove backup archives and SQL dumps from document roots.
- Fix dangerous file permissions on files like `wp-config.php`.
- Bind internal app ports such as dev or admin backends to loopback if they do not need public reachability.

### Review carefully before applying

- Limit origin access to trusted reverse proxies or admin IPs if Cloudflare is the intended edge.
- Reduce Apache `AllowOverride All` usage where not needed.
- Remove `Options Indexes` from vhosts after confirming no directory browsing is intentionally used.
- Disable unnecessary remote-access services on the server, but only after confirming operational dependencies.
- Tighten SSH options such as `X11Forwarding no` after checking admin workflows.

### Optional future enhancements

- Add a lightweight email step that sends only the executive summary.
- Add a signed digest of each report for tamper evidence.
- Add a weekly report that aggregates 7-day and 30-day trends.
- Add optional Wazuh, OSSEC, or auditd later if you want deeper telemetry.
- Add an external-origin scan from a second trusted host for exposure validation.
