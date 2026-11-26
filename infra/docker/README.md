# ShopSphere: Docker Guide

Everything you need to run ShopSphere's infrastructure (and, if you want, the whole shop) in Docker on your PC.
All of it runs **locally**: databases, Kafka, RabbitMQ, S3 storage, email catcher and AI model. Internet is only
needed the first time, to download images.

- **Files here:** [`docker-compose.yml`](docker-compose.yml) (all services), [`.env.example`](.env.example) (your
  local settings), [`images/`](images/) (Dockerfiles), [`traefik/`](traefik/), [`rabbitmq/`](rabbitmq/),
  [`seaweedfs/`](seaweedfs/), [`init/postgres/`](init/postgres/).
- **Learn it line by line:** [`docs/course/ShopSphere-Docker-YAML.pdf`](../../docs/course/ShopSphere-Docker-YAML.pdf).

---

## 1. First-time setup (once)

1. Install **Docker Desktop** (Windows: WSL 2 backend). In *Settings -> Resources* give it **6-8 GB** of memory.
2. Add the local domains to your hosts file (Windows: `C:\Windows\System32\drivers\etc\hosts`, edit as Administrator):

   ```text
   127.0.0.1 shop.localhost admin.localhost
   ```

3. Create your local settings file:

   ```bash
   cp infra/docker/.env.example infra/docker/.env
   ```

4. **PostgreSQL or MongoDB also installed on your PC?** Their ports are taken, so move the containers.
   Edit `infra/docker/.env`:

   ```text
   POSTGRES_PORT=5433
   MONGO_PORT=27018
   ```

   and use the same ports in the services' `.env` files, e.g.
   `DATABASE_URL=postgres://shop:shop_dev_pw@localhost:5433/shopsphere`.

5. Install Node dependencies once (the shortcuts below are pnpm scripts): `pnpm install`.

---

## 2. Everyday commands

Run them from **any folder** of the repo (PowerShell, Git Bash or the VS Code terminal).

### Start

| Command | Starts | Typical use |
| ------- | ------ | ----------- |
| `pnpm docker:core` | PostgreSQL, MongoDB, Redis, Mailpit, Traefik | Working on auth, user, order |
| `pnpm docker:up` | core **+ Kafka, RabbitMQ, S3 storage** (topics, queues and buckets created automatically) | Most days |
| `pnpm docker:ai` | Ollama + downloads the AI models (first time about 2.5 GB) | AI chat work |
| `pnpm docker:obs` | Grafana, Prometheus, Loki, Tempo, OpenTelemetry collector | Observability work |
| `pnpm docker:apps` | **The whole shop in containers** (builds images, includes brokers and storage) | Demo, end-to-end testing |

All start commands wait until every container is **healthy** before returning.

### Look

| Command | Shows |
| ------- | ----- |
| `pnpm docker:ps` | Every container, its state and health. Init jobs should show `Exited (0)` |
| `pnpm docker:logs` | Last 100 lines of every container, then follows new lines (Ctrl+C to quit) |
| `pnpm docker:logs kafka` | Logs of one service (any service name works) |
| `pnpm docker:config` | Checks `docker-compose.yml` is valid (all profiles) |

### Open a shell into a database

| Command | Opens |
| ------- | ----- |
| `pnpm docker:psql` | `psql` in PostgreSQL (`\dn` lists schemas, `\q` quits) |
| `pnpm docker:mongo` | `mongosh` in MongoDB |
| `pnpm docker:redis` | `redis-cli` in Redis |

### Stop and clean up

| Command | Effect | Data |
| ------- | ------ | ---- |
| `pnpm docker:stop` | Stops containers, keeps them | Kept |
| `pnpm docker:down` | Stops and removes containers and network | **Kept** (volumes stay) |
| `pnpm docker:wipe` | Removes containers **and all volumes** | **Deleted**: databases, queues, S3 files, AI models |

### Anything else

`pnpm docker <any docker compose command>` runs Docker Compose with the right file, for example:

```bash
pnpm docker exec postgres pg_isready              # run a command in a container
pnpm docker restart order                         # restart one service
pnpm docker --profile apps up -d --build order    # rebuild and restart one app
pnpm docker run --rm kafka-init                   # re-run an init job
```

Prefer plain Docker Compose? From `infra/docker/` every shortcut is the same command without the
`-f` option, e.g. `docker compose --profile events --profile files up -d --wait`.

---

## 3. Profiles: what each one contains

| Profile | Services | Ports on your PC |
| ------- | -------- | ---------------- |
| *(core, always)* | `postgres`, `mongo`, `redis`, `mailpit`, `traefik` | 5432, 27017, 6379, 1025/8025, 80/8080 |
| `events` | `kafka`, `kafka-init`, `kafka-ui`, `rabbitmq`, `rabbitmq-init` | 9092, 8085, 5672/15672 |
| `files` | `s3` (SeaweedFS), `storage-init` | 8333 |
| `ai` | `ollama`, `ollama-init` | 11434 |
| `obs` | `lgtm` | 3001, 4317, 4318 |
| `apps` | 14 app containers + everything from `events` and `files` | 3000, 4000-4004, 5173, 8000, 8001 |

Every port is bound to `127.0.0.1`: reachable from your PC only, not from your network.

**Init jobs** (run once, then exit; safe to re-run):

| Job | Creates |
| --- | ------- |
| `kafka-init` | Topics `orders.events` (6 partitions), `users.events`, `imports.events` + `.dlt` dead-letter topics |
| `rabbitmq-init` | Exchanges `jobs`, `jobs.dlx`; quorum queues `notifications`, `etl.jobs`, `support` + `.dlq` queues |
| `storage-init` | Buckets `imports`, `invoices`; browser CORS; "delete `raw/` after 30 days" rule |
| `ollama-init` | Models `llama3.2:3b` and `nomic-embed-text` |
| Postgres `init/postgres/*.sql` | Schemas `auth`, `users`, `orders`, `imports`, `ai`, `analytics`; extensions `vector`, `pg_stat_statements` (first start only) |

---

## 4. URLs and logins

| What | Address | Login |
| ---- | ------- | ----- |
| Shop (through Traefik) | http://shop.localhost | |
| Admin (through Traefik) | http://admin.localhost | |
| Traefik dashboard | http://localhost:8080 | |
| RabbitMQ UI | http://localhost:15672 | guest / guest |
| Kafka UI | http://localhost:8085 | |
| Mailpit (all sent emails) | http://localhost:8025 | |
| Grafana | http://localhost:3001 | admin / admin |
| S3 API (SeaweedFS) | http://localhost:8333 | key `shopsphere`, secret `shopsphere_dev_secret` |
| PostgreSQL | `localhost:5432` (or your `POSTGRES_PORT`) | shop / shop_dev_pw, database `shopsphere` |
| MongoDB | `localhost:27017` (or your `MONGO_PORT`) | no auth (dev) |
| Redis | `localhost:6379` | no auth (dev) |
| Kafka (from your PC) | `localhost:9092` | |
| Ollama | http://localhost:11434 | |

**From your PC vs from a container:** your PC uses `localhost:<port>`; containers use the **service name**:
`postgres:5432`, `kafka:19092`, `s3:8333`, `rabbitmq:5672`. The app containers already get these in
`x-app-env` inside `docker-compose.yml`.

---

## 5. Two ways to develop

| Mode | How | Best for |
| ---- | --- | -------- |
| **Infra in Docker, code on your PC** (recommended) | `pnpm docker:up`, then `pnpm dev --filter=@shopsphere/order` / `uv run --package import-api import-api` | Daily coding: hot reload, debugger |
| **Everything in Docker** | `pnpm docker:apps` | Demos, testing the real images, checking the ECS/EKS behaviour |

Traefik routes `shop.localhost` / `admin.localhost` to ports 3000 / 5173 / 4000 / 4004 on your PC, so both modes
work with the same URLs. Don't run the same app in both modes at once (the ports would clash).

---

## 6. Building images

The same images run locally and on AWS ECS / EKS.

```bash
pnpm docker:build                                      # all 14 app images
pnpm docker --profile apps build order import-api      # just some

# or plain docker, from the repo root:
docker build -f infra/docker/images/node.Dockerfile --target service --build-arg PACKAGE=@shopsphere/order -t shopsphere/order .
docker build -f infra/docker/images/node.Dockerfile --target web     --build-arg PACKAGE=@shopsphere/web   -t shopsphere/web .
docker build -f infra/docker/images/node.Dockerfile --target admin   --build-arg PACKAGE=@shopsphere/admin -t shopsphere/admin .
docker build -f infra/docker/images/python.Dockerfile --build-arg SERVICE=import-api -t shopsphere/import-api .
```

| Dockerfile | Target | Builds |
| ---------- | ------ | ------ |
| `images/node.Dockerfile` | `service` | bff, auth, user, order, realtime-gateway, outbox-relay, notification-worker, analytics-consumer, cache-updater |
| `images/node.Dockerfile` | `web` | Next.js customer app |
| `images/node.Dockerfile` | `admin` | React admin served by nginx |
| `images/python.Dockerfile` | `runtime` | import-api, etl-worker, ai-chat |

All images run as non-root users, read config from environment variables only, and stop gracefully on SIGTERM.

---

## 7. Using Cloudflare R2 instead of local S3

1. Cloudflare dashboard -> R2 -> **Manage API tokens** -> create an **Object Read & Write** token.
2. In `infra/docker/.env`, uncomment and fill in the R2 block (`S3_ENDPOINT`, `S3_REGION=auto`, keys, bucket names).
3. Create the buckets, CORS and lifecycle rule on R2:

   ```bash
   pnpm docker:storage-init
   ```

4. Put the same values in `services/import-api/.env` and `services/etl-worker/.env` when you run them on your PC.

Keys stay in the git-ignored `.env` files, never in `docker-compose.yml`. R2 does not support presigned **POST**
uploads: use presigned **PUT** (see the Docker/YAML book, Chapter 11).

---

## 8. Data

| Volume | Holds |
| ------ | ----- |
| `shopsphere_pgdata` | PostgreSQL |
| `shopsphere_mongodata` | MongoDB |
| `shopsphere_redisdata` | Redis (append-only file) |
| `shopsphere_kafkadata` | Kafka topics |
| `shopsphere_rabbitdata` | RabbitMQ queues |
| `shopsphere_s3data` | S3 files (SeaweedFS) |
| `shopsphere_ollamadata` | AI models |
| `shopsphere_lgtmdata` | Grafana / metrics / logs / traces |

- Data survives `pnpm docker:down` and restarts. Only `pnpm docker:wipe` deletes it.
- Postgres SQL files in `init/postgres/` run **only when the volume is empty**. After changing them, apply the
  change by hand (`pnpm docker:psql`) or start fresh with `pnpm docker:wipe`.
- Delete one volume only: `pnpm docker down`, then `docker volume rm shopsphere_s3data`.

---

## 9. Troubleshooting

| Problem | Fix |
| ------- | --- |
| `ports are not available ... 5432` (or 27017, 6379) | A native install uses the port. Set `POSTGRES_PORT` / `MONGO_PORT` / `REDIS_PORT` in `infra/docker/.env` |
| `ports are not available ... 4001` (or 3000, 5173...) when running `docker:apps` | That app is also running on your PC with `pnpm dev`. Stop one of them |
| A container is `unhealthy` | `pnpm docker:logs <service>`; details: `docker inspect --format "{{json .State.Health}}" shopsphere-<service>-1` |
| An init job shows `Exited (1)` | `pnpm docker logs <job>` shows the failing command; fix, then `pnpm docker run --rm <job>` |
| `pull access denied` / image not found | The image was removed from Docker Hub (happened to MinIO). Check `docker manifest inspect <image>` and switch image |
| Kafka works from containers but not your PC (or the reverse) | PC: `localhost:9092`, containers: `kafka:19092` |
| `localhost` does not work inside a container | Use the service name (`postgres:5432`) |
| `http://shop.localhost` gives 502 | Nothing runs on the target port yet: start `pnpm dev` or `pnpm docker:apps` |
| `http://shop.localhost` does not resolve | Add the hosts-file line from step 1 |
| Container exits with code **137** | Out of memory: give Docker Desktop more RAM or start fewer profiles |
| `/bin/sh^M: bad interpreter` | Windows line endings; `.gitattributes` prevents it; re-clone or `git add --renormalize .` |
| Disk full | `docker system df`, then `docker builder prune` and `docker image prune` |
| Start completely fresh | `pnpm docker:wipe`, then `pnpm docker:up` |
