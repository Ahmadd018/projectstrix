# Installation & Deployment

Deploying Project Strix is extremely simple thanks to the included self-healing `global_deploy.py` auto-deployer script. It is designed to work seamlessly on fresh minimal cloud servers (e.g., Ubuntu/Debian) as well as development environments.

## Prerequisites
- A Linux-based OS (Ubuntu 22.04/24.04 recommended)
- `python3` and `sudo` privileges
- Git

*(Note: Node.js, PM2, PostgreSQL, and other dependencies will be automatically installed and configured by the deployer script if missing.)*

## Deployment Steps

### 1. Clone the Repository
Access your server via SSH and clone the project:
```bash
git clone https://github.com/infat0x/ProjectStrix.git
cd ProjectStrix
```

### 2. Run the Auto-Deployer
The `global_deploy.py` script acts as a self-healing deployment engine. Execute it with root privileges:

```bash
sudo python3 global_deploy.py
```

### What `global_deploy.py` handles automatically:
1. **Dependency Installation**: Checks for and installs required packages (Node.js v20, PM2, PostgreSQL, etc.) using non-interactive modes to prevent hangs.
2. **Self-Healing Mechanics**: Automatically detects and recovers from broken `dpkg` states, missing OS `locales` (which often break Postgres installs), and dynamically resolves PostgreSQL connection ports.
3. **Database Configuration**: Reinstalls or fixes PostgreSQL, forces it to listen on TCP, creates the `strix` database, and sets up the `strix_user` with secure `pg_hba.conf` rules.
4. **Environment Setup**: Automatically generates the `.env` file for the dashboard with the correct dynamic PostgreSQL URL.
5. **Dashboard Build**: Cleans old builds, installs NPM packages (`--legacy-peer-deps`), pushes the Prisma schema, and creates an optimized Next.js production build.
6. **Service Deployment**: Kills conflicting processes on port `48080`, and starts the Strix Dashboard daemon via PM2.

### 3. Accessing the Dashboard
Once the script completes, Strix will be live and running in the background.
Access the web interface by navigating to:
```
http://<your-server-ip>:48080
```

## Useful Commands
After deployment, you can use these commands to manage the Strix service:

- **View Live Logs**: `sudo pm2 logs strix-dashboard`
- **Check Status**: `sudo pm2 status`
- **Restart Dashboard**: `sudo pm2 restart strix-dashboard`
- **Stop Dashboard**: `sudo pm2 stop strix-dashboard`
- **Database Access**: `sudo -u postgres psql -d strix`
- **Test Strix CLI**: `strix --help`
