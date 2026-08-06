#!/usr/bin/env python3
import os
import sys
import subprocess
import getpass
import time

# --- Colors for Output ---
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(msg):
    print(f"\n{Colors.OKBLUE}{Colors.BOLD}==>{Colors.ENDC} {Colors.BOLD}{msg}{Colors.ENDC}")

def print_success(msg):
    print(f"{Colors.OKGREEN}✔ {msg}{Colors.ENDC}")

def print_error(msg):
    print(f"{Colors.FAIL}✖ {msg}{Colors.ENDC}")

def run_cmd(cmd, fail_on_error=True, shell=True, env=None):
    """Run a shell command and return its exit code and output."""
    try:
        result = subprocess.run(
            cmd,
            shell=shell,
            executable="/bin/bash" if shell else None,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        if result.returncode != 0 and fail_on_error:
            print_error(f"Command failed: {cmd}")
            print(result.stdout)
            sys.exit(result.returncode)
        return result.returncode, result.stdout
    except Exception as e:
        if fail_on_error:
            print_error(f"Exception while running command: {cmd}\n{e}")
            sys.exit(1)
        return 1, str(e)

def check_root():
    print_step("Checking permissions...")
    if os.geteuid() != 0:
        print_error("This script must be run as root (use sudo).")
        print("Example: sudo python3 global_deploy.py")
        sys.exit(1)
    print_success("Running as root.")

def install_system_packages():
    print_step("Installing System Dependencies...")
    run_cmd("apt-get update -y")
    packages = ["git", "curl", "python3-pip", "python3-venv", "postgresql", "postgresql-contrib", "fuser"]
    for pkg in packages:
        run_cmd(f"apt-get install -y {pkg}")
    print_success("System packages installed successfully.")

def setup_postgresql():
    print_step("Setting up PostgreSQL...")
    run_cmd("systemctl enable postgresql")
    run_cmd("systemctl start postgresql")

    # Create database and user if they don't exist
    db_name = "strix"
    db_user = "strix_user"
    db_pass = "strix_password_123"

    print("Configuring Database and User...")
    # Using psql as postgres user
    run_cmd(f"sudo -u postgres psql -tc \"SELECT 1 FROM pg_database WHERE datname = '{db_name}'\" | grep -q 1 || sudo -u postgres psql -c \"CREATE DATABASE {db_name}\"", fail_on_error=False)
    run_cmd(f"sudo -u postgres psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='{db_user}'\" | grep -q 1 || sudo -u postgres psql -c \"CREATE USER {db_user} WITH ENCRYPTED PASSWORD '{db_pass}'\"", fail_on_error=False)
    run_cmd(f"sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE {db_name} TO {db_user}\"", fail_on_error=False)
    run_cmd(f"sudo -u postgres psql -c \"ALTER DATABASE {db_name} OWNER TO {db_user}\"", fail_on_error=False)
    
    print_success("PostgreSQL configured successfully.")

def install_nodejs():
    print_step("Checking/Installing Node.js and npm...")
    code, out = run_cmd("node -v", fail_on_error=False)
    if code != 0 or not out.startswith("v20"):
        print("Installing Node.js LTS (v20)...")
        run_cmd("curl -fsSL https://deb.nodesource.com/setup_20.x | bash -")
        run_cmd("apt-get install -y nodejs")
    else:
        print("Node.js v20 is already installed.")

    print("Checking PM2...")
    code, out = run_cmd("pm2 -v", fail_on_error=False)
    if code != 0:
        run_cmd("npm install -g pm2")
    else:
        print("PM2 is already installed.")
    print_success("Node.js and PM2 are ready.")

def install_strix():
    print_step("Installing Strix Core...")
    strix_dir = "/opt/strix_core"
    
    if os.path.exists(strix_dir):
        print("Strix source directory already exists, pulling latest...")
        run_cmd(f"cd {strix_dir} && git pull origin main", fail_on_error=False)
    else:
        print("Cloning infat0x/strix repository...")
        run_cmd(f"git clone https://github.com/infat0x/strix {strix_dir}")
    
    # We install strix globally using pip, ensuring it uses the system python or a global space
    print("Installing Strix CLI...")
    run_cmd(f"cd {strix_dir} && pip3 install --break-system-packages .", fail_on_error=False)
    
    # Verify installation
    code, out = run_cmd("strix --help", fail_on_error=False)
    if code == 0:
        print_success("Strix installed successfully (/usr/local/bin/strix).")
    else:
        # Fallback if pip put it somewhere else
        print(f"{Colors.WARNING}strix not found in PATH, trying to locate it...{Colors.ENDC}")
        code, out = run_cmd("find /usr -name strix -type f -executable | head -n 1", fail_on_error=False)
        strix_path = out.strip()
        if strix_path:
            run_cmd(f"ln -sf {strix_path} /usr/local/bin/strix")
            print_success(f"Strix linked to /usr/local/bin/strix")
        else:
            print_error("Failed to verify Strix installation.")
            sys.exit(1)

def setup_dashboard():
    print_step("Setting up Strix Dashboard...")
    dashboard_dir = os.path.join(os.getcwd(), "strix-dashboard")
    if not os.path.exists(dashboard_dir):
        print_error(f"Dashboard directory not found at: {dashboard_dir}")
        sys.exit(1)
        
    env_file = os.path.join(dashboard_dir, ".env")
    if not os.path.exists(env_file):
        print("Creating .env file...")
        with open(env_file, "w") as f:
            f.write("DATABASE_URL=\"postgresql://strix_user:strix_password_123@localhost:5432/strix?schema=public\"\n")
            f.write("SESSION_SECRET=\"super-secret-key-12345\"\n")
            f.write("WEBHOOK_SECRET=\"strix-webhook-secret\"\n")
            
    print("Installing npm dependencies...")
    run_cmd(f"cd {dashboard_dir} && npm install --legacy-peer-deps")
    
    print("Applying Prisma migrations...")
    run_cmd(f"cd {dashboard_dir} && npx prisma generate")
    run_cmd(f"cd {dashboard_dir} && npx prisma db push --accept-data-loss")
    
    print("Building Next.js for Production...")
    run_cmd(f"cd {dashboard_dir} && rm -rf .next && npm run build")
    
    print_success("Dashboard setup completed.")

def deploy_service():
    print_step("Deploying Strix Dashboard as a PM2 Service...")
    dashboard_dir = os.path.join(os.getcwd(), "strix-dashboard")
    
    # Kill any process on port 80 to prevent EADDRINUSE
    run_cmd("fuser -k 80/tcp", fail_on_error=False)
    
    # Delete existing pm2 process if it exists
    run_cmd("pm2 delete strix-dashboard", fail_on_error=False)
    
    # Start the app via PM2
    print("Starting Next.js via PM2 on port 80...")
    run_cmd(f"cd {dashboard_dir} && pm2 start npm --name 'strix-dashboard' -- run start -- -H 0.0.0.0 -p 80")
    
    # Save PM2 list and configure startup
    run_cmd("pm2 save")
    run_cmd("pm2 startup | tail -n 1 | bash", fail_on_error=False)
    
    print_success("Deployment completed successfully. The application is running in the background.")

def main():
    print(f"\n{Colors.OKCYAN}{Colors.BOLD}=== STRIX GLOBAL AUTO-DEPLOYER ==={Colors.ENDC}\n")
    check_root()
    install_system_packages()
    setup_postgresql()
    install_nodejs()
    install_strix()
    setup_dashboard()
    deploy_service()
    
    print(f"\n{Colors.OKGREEN}{Colors.BOLD}🎉 ALL DONE! Strix is now live.{Colors.ENDC}")
    print(f"{Colors.OKCYAN}Dashboard: http://<your-server-ip>{Colors.ENDC}")
    print(f"{Colors.OKCYAN}To view logs, run: {Colors.BOLD}pm2 logs strix-dashboard{Colors.ENDC}")

if __name__ == "__main__":
    main()
