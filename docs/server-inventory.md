# ARM64 server inventory and coexistence plan

Source: owner-supplied terminal audit on 2026-10-15. Observations are point-in-time, not a load test.
Food Minutes is the product planning name; the repository and proposed service namespace remain MenuMinute.

## Selected host

| Item                    | Observed value                                         |
| ----------------------- | ------------------------------------------------------ |
| Provider / hostname     | Oracle Cloud; bababuilds-erp                           |
| OS / kernel             | Ubuntu 24.04.4 LTS; Linux 6.17.0-1019-oracle           |
| Architecture            | aarch64 / ARM64; KVM VM                                |
| CPU                     | 4 visible Neoverse-N1 ARM cores; one thread per core   |
| Memory                  | 23 GiB total, 2.8 GiB used, about 20 GiB available     |
| Swap                    | 256 MiB zram, unused at audit                          |
| CPU sample              | 99–100% idle, 0% steal in four live one-second samples |
| Load averages           | 0.04 / 0.03 / 0.01                                     |
| Root storage            | 72 GB ext4 filesystem on a 75 GB disk                  |
| After confirmed cleanup | 30 GB used, 43 GB available, 42% utilization           |
| Inodes                  | 5% used before cleanup                                 |
| Failed systemd units    | None reported                                          |

Ollama/Open WebUI files were removed by the owner; the subsequent `df -h /` confirms the storage
figure above. Steam removal was requested, but its completion and any further disk recovery were
not supplied. Do not include that space in the baseline. Exact OCI shape, allocation entitlement,
region, bandwidth and backup configuration remain unverified; do not infer them from visible CPUs.

The alternative CBS AMD64 server had 956 MiB RAM, 94 MiB available, no swap, load over 11 and
61–74% steal in live samples. It is not the selected ordering-production host.

## Existing applications and services

| Component                   | Observed state                                                                   |
| --------------------------- | -------------------------------------------------------------------------------- |
| ERP website                 | erp.bababuilds.com; Nginx proxies to localhost:3000                              |
| ERP process manager         | Root PM2, one online `erp` entry; fork mode                                      |
| ERP application             | Next.js child about 706 MiB RSS; PM2 launcher about 60 MiB separately            |
| ERP files                   | /var/www/bababuilds-erp, about 5.8 GB; preserve                                  |
| Nginx default site          | /var/www/html; no second named website in supplied configuration                 |
| Docker                      | Daemon installed/running; no containers, images, volumes or build cache          |
| Security                    | ClamAV about 1 GiB RSS; CrowdSec about 430 MiB RSS plus firewall bouncer         |
| Administration / monitoring | Cockpit socket, Tailscale, Zabbix Agent 2, Oracle agents                         |
| ERP database                | Not identified; may be embedded or remote; discover without exposing secrets     |
| PM2 versions                | In-memory 7.0.3, installed 6.0.14; reconcile in a planned ERP maintenance window |

No Ollama/Open WebUI processes or matching systemd unit files were found before cleanup.
No production credentials, machine IDs or SSH keys belong in this inventory.

## Listener and firewall findings

| Listener      | Audit finding                     | Intended treatment                                          |
| ------------- | --------------------------------- | ----------------------------------------------------------- |
| 80/443 TCP    | Nginx on wildcard interfaces      | Public web entry points                                     |
| 3000 TCP      | ERP Next.js on wildcard interface | Bind loopback through Nginx after ERP compatibility check   |
| 22 TCP        | SSH socket on wildcard interfaces | Preserve access; restrict to trusted management paths       |
| 9090 TCP      | Cockpit socket on IPv6 wildcard   | Administrative access only; verify IPv4/IPv6 reachability   |
| 10050 TCP     | Zabbix wildcard listener          | Monitoring sources only                                     |
| 111 TCP/UDP   | rpcbind on IPv4/IPv6 wildcard     | Discover dependencies; restrict or disable if unused        |
| 41641 UDP     | Tailscale wildcard listener       | Preserve according to reviewed Tailscale connectivity needs |
| 6060/8080 TCP | CrowdSec loopback                 | Keep private; do not reuse 8080 for the app                 |

Supplied nftables output shows IPv4 and IPv6 INPUT policy accept with CrowdSec blocklist jumps;
there is no general inbound port allowlist in that output. Docker FORWARD rules do not restrict
host listeners. UFW produced no output from the command-availability guard. This does not prove
public exposure: inspect OCI security lists/NSGs and routing too. Keep existing CrowdSec/Docker
rules; do not flush the firewall. Verify SSH/Tailscale and recovery-console access before changes.

## Proposed Food Minutes coexistence

- Separate non-root account, systemd units, secrets, release tree and persistent data from ERP.
- Proposed web binding: 127.0.0.1:3100, matching committed systemd/Nginx templates; confirm free at provisioning. ERP keeps port 3000.
- Separate PostgreSQL role/database and separate queue/cache Redis processes with private listeners.
  Confirm ports and existing ERP storage dependencies before provisioning.
- Explicit per-service memory/CPU limits, bounded pg pools, worker concurrency and queue retention.
  Choose actual values after peak ERP measurements; 20 GiB available is not all reserved for this app.
- Build in external Ubuntu 24.04 ARM64 CI; never install a general PR runner on the ERP host.
- Keep uploads in R2, backups encrypted off-host, logs/releases/WAL under monitored retention.
- Stage Nginx changes, validate configuration and preserve ERP routing/certificates.
- Test ERP health before and after changes and under representative joint peak load.

This is an initial single-host deployment, not high availability or a million-order throughput claim.
Still required: OCI shape/region and network rules, public app domain/TLS, peak ERP and ordering
traffic, storage growth, SLO, RPO/RTO, restore rehearsal and escalation owner.
