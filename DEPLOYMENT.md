# Bubble Breaker - Synology NAS Deployment Guide

This guide explains how to deploy the Bubble Breaker game on your Synology DS224+ NAS using Docker and reverse proxy.

## Prerequisites

- Synology DS224+ with DSM 7.x
- Docker package installed from Package Center
- Reverse proxy configured in Application Portal
- SSH access to your NAS (optional, for command line deployment)

## Deployment Steps

### 1. Build Production Files Locally

First, ensure you have the latest production build:
```bash
npm run build
```

This creates optimized files in `dist/bubble-breaker/browser/` (~270KB total).

### 2. Prepare the Deployment Package

Transfer ONLY these files to your NAS:
- `Dockerfile` (simplified for pre-built files)
- `docker-compose.yml`
- `nginx.conf`
- `dist/bubble-breaker/browser/` folder (complete folder with all contents)

**What NOT to transfer:**
- `src/` folder (source code)
- `node_modules/` (dependencies)
- `package.json` / `package-lock.json`
- Any development files

### 3. Deploy via Container Manager (GUI Method)

1. Open **Container Manager** in DSM
2. Go to **Project** tab
3. Click **Create**
4. Upload the deployment package to a folder (e.g., `/volume1/docker/bubble-breaker/`)
5. Point Container Manager to this folder
6. The container will build quickly using the simplified `Dockerfile` (no npm install/build required)

### 4. Deploy via SSH (Command Line Method)

```bash
# Navigate to deployment directory
cd /volume1/docker/bubble-breaker

# Build and start the container (fast build with pre-built files)
docker-compose up -d --build

# Check status
docker-compose ps
```

### 5. Configure Reverse Proxy

1. Open **Control Panel** > **Application Portal** > **Reverse Proxy**
2. Click **Create**
3. Configure as follows:
   - **Description**: Bubble Breaker Game
   - **Source**:
     - Protocol: HTTPS (recommended) or HTTP
     - Hostname: `bubble-breaker.yourdomain.com` (or your domain)
     - Port: 443 (HTTPS) or 80 (HTTP)
   - **Destination**:
     - Protocol: HTTP
     - Hostname: localhost
     - Port: 8080

4. Click **Save**

### 6. SSL Certificate (Optional but Recommended)

1. Go to **Control Panel** > **Security** > **Certificate**
2. Add/import your SSL certificate
3. Assign it to the reverse proxy rule

## Configuration Options

### Port Configuration

The container exposes port 80 internally and maps to port 8080 on the host. You can change this in `docker-compose.yml`:

```yaml
ports:
  - "8080:80"  # Change 8080 to your preferred port
```

### Domain Configuration

Update the Traefik labels in `docker-compose.yml` if you're using Traefik:

```yaml
labels:
  - "traefik.http.routers.bubble-breaker.rule=Host(`bubble-breaker.yourdomain.com`)"
```

## Health Monitoring

The container includes health checks. Monitor via:

```bash
# Check container health
docker-compose ps

# View logs
docker-compose logs bubble-breaker

# Check health endpoint directly
curl http://localhost:8080/health
```

## Updating the Application

1. **Build locally**: Run `npm run build` to create new production files
2. **Replace files**: Update the `dist/bubble-breaker/browser/` folder on your NAS
3. **Rebuild container**:

```bash
docker-compose down
docker-compose up -d --build
```

**Note**: Only the dist/ folder needs updating for app changes. Dockerfile, nginx.conf, and docker-compose.yml typically remain unchanged.

## Troubleshooting

### Container Won't Start
- Check logs: `docker-compose logs bubble-breaker`
- Verify port 8080 is not in use: `netstat -tulpn | grep 8080`

### Can't Access via Domain
- Check reverse proxy configuration
- Verify DNS points to your NAS IP
- Check firewall settings

### Performance Issues
- Monitor resource usage in Container Manager
- Consider adjusting container resources if needed

## Deployment Package Structure

**Files to transfer to NAS (~275KB total):**
```
bubble-breaker-deployment/
├── Dockerfile                          # Simplified container build
├── docker-compose.yml                  # Deployment configuration
├── nginx.conf                          # Web server configuration
└── dist/bubble-breaker/browser/        # Pre-built app files (~270KB)
    ├── index.html
    ├── main-TZ4MDVIE.js
    ├── polyfills-5CFQRCPP.js
    ├── styles-5INURTSO.css
    └── favicon.ico
```

**Development files (NOT needed for deployment):**
```
bubble-breaker-source/
├── src/                       # Angular source code
├── node_modules/              # Dependencies
├── package.json               # Build configuration
└── ...                        # Other development files
```

## Security Notes

- The Nginx configuration includes security headers
- Health check endpoint is available at `/health`
- Static assets are cached for performance
- Consider using HTTPS in production

## Support

For issues with the deployment process, check:
1. Container Manager logs in DSM
2. Docker container logs
3. Reverse proxy configuration
4. Network connectivity