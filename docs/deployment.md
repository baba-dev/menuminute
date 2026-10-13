# MenuMinute — Deployment Guide (Oracle Cloud ARM64 Ubuntu VPS)

## 1. Target Infrastructure Overview

- **Hosting Platform**: Oracle Cloud Always Free Tier (Ampere ARM64 Compute Instance)
- **Specifications**: 4 OCPUs, 24 GB RAM, 200 GB Block Storage
- **Operating System**: Ubuntu 24.04 LTS (aarch64 / ARM64)
- **Web Server / Reverse Proxy**: Nginx with Let's Encrypt SSL
- **Process Supervisor**: Linux `systemd`
- **Database Engine**: Persistent SQLite on NVMe storage with WAL mode

---

## 2. Server Architecture

```text
               Internet (:443 HTTPS)
                         │
                         ▼
             ┌─────────────────────────┐
             │   Nginx Reverse Proxy   │
             │   (SSL Termination)     │
             └───────────┬─────────────┘
                         │ Proxy Pass (HTTP :3000)
                         ▼
             ┌─────────────────────────┐
             │     MenuMinute App      │
             │  (Node.js / systemd)    │
             └───────────┬─────────────┘
                         │
                         ▼
        ┌───────────────────────────────────┐
        │ /var/lib/menuminute/data/          │
        │ └── menuminute.sqlite (WAL Mode)  │
        └───────────────────────────────────┘
```

---

## 3. Deployment Directory Layout

To protect the persistent database during zero-downtime releases, persistent data must reside outside the application release directory:

- **Application Directory**: `/opt/menuminute/app`
- **Persistent Data Directory**: `/var/lib/menuminute/data`
- **Persistent Uploads Directory**: `/var/lib/menuminute/uploads`
- **Database Path**: `DATABASE_URL=/var/lib/menuminute/data/menuminute.sqlite`

---

## 4. Systemd Service Unit (`/etc/systemd/system/menuminute.service`)

```ini
[Unit]
Description=MenuMinute Restaurant SaaS Application
After=network.target

[Service]
Type=simple
User=menuminute
WorkingDirectory=/opt/menuminute/app
EnvironmentFile=/etc/menuminute/production.env
ExecStart=/usr/bin/node /opt/menuminute/app/node_modules/next/dist/bin/next start -p 3000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=menuminute

# Sandboxing & Security
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

---

## 5. Nginx Configuration (`/etc/nginx/sites-available/menuminute.conf`)

```nginx
server {
    listen 80;
    server_name menuminute.com www.menuminute.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name menuminute.com www.menuminute.com;

    # SSL Certificates (managed via Certbot)
    ssl_certificate /etc/letsencrypt/live/menuminute.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/menuminute.com/privkey.pem;

    # Performance & Caching
    client_max_body_size 10M;

    # Static Assets Cache
    location /_next/static/ {
        alias /opt/menuminute/app/.next/static/;
        expires 365d;
        access_log off;
    }

    # Public Uploads
    location /uploads/ {
        alias /var/lib/menuminute/uploads/;
        expires 30d;
        access_log off;
    }

    # Application Proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 6. SQLite Backup Strategy (Online Backups)

Because SQLite operates in WAL mode, backups can be performed online without shutting down the service or blocking read queries:

```bash
#!/bin/bash
# /opt/menuminute/scripts/backup.sh
BACKUP_DIR="/var/backups/menuminute"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="/var/lib/menuminute/data/menuminute.sqlite"
TARGET="$BACKUP_DIR/menuminute_$TIMESTAMP.sqlite"

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB_FILE" ".backup '$TARGET'"
gzip -9 "$TARGET"

# Retain 30 days of daily backups
find "$BACKUP_DIR" -type f -name "*.sqlite.gz" -mtime +30 -delete
```

Schedule via crontab:

```cron
0 3 * * * /opt/menuminute/scripts/backup.sh
```
