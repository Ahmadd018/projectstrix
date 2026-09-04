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
        print("Example: sudo python3 runner/deploy.py")
        sys.exit(1)
    print_success("Running as root.")

def install_system_packages():
    print_step("Installing System Dependencies...")
    packages = ["git", "curl", "python3-pip", "python3-venv", "postgresql", "postgresql-contrib", "psmisc", "docker.io"]
    needs_install = []
    for pkg in packages:
        code, _ = run_cmd(f"dpkg -s {pkg}", fail_on_error=False, shell=True)
        if code != 0:
            needs_install.append(pkg)
            
    if needs_install:
        print(f"Missing packages: {', '.join(needs_install)}. Updating apt and installing...")
        # Recover from interrupted dpkg if any
        run_cmd("export DEBIAN_FRONTEND=noninteractive && dpkg --configure -a", fail_on_error=False)
        run_cmd("export DEBIAN_FRONTEND=noninteractive && apt-get update -y")
        for pkg in needs_install:
            run_cmd(f"export DEBIAN_FRONTEND=noninteractive && apt-get install -y {pkg}")
        print_success("Missing system packages installed successfully.")
    else:
        print_success("All system packages are already installed.")
    
    print_step("Ensuring Docker is running...")
    run_cmd("systemctl enable docker", fail_on_error=False)
    run_cmd("systemctl start docker", fail_on_error=False)

def get_db_password():
    """H-2: Return a stable DB password — reuse the one already in .env if present,
    otherwise generate a fresh random one. Never use a hardcoded default."""
    import secrets
    import re
    dashboard_dir = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')), "strix-dashboard")
    env_file = os.path.join(dashboard_dir, ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file) as f:
                content = f.read()
            m = re.search(r'postgresql://strix_user:([^@]+)@', content)
            if m:
                return m.group(1)
        except Exception:
            pass
    # token_urlsafe yields only URL-safe chars (A-Za-z0-9_-), safe in a DATABASE_URL.
    return secrets.token_urlsafe(24)

def setup_postgresql(db_pass):
    print_step("Setting up PostgreSQL...")
    run_cmd("systemctl enable postgresql")
    run_cmd("systemctl start postgresql")

    code, _ = run_cmd("sudo -u postgres psql -c 'SELECT 1;'", fail_on_error=False)
    if code != 0:
        print("PostgreSQL is not responding (likely broken install due to missing locales). Fixing...")
        run_cmd("export DEBIAN_FRONTEND=noninteractive && dpkg --configure -a", fail_on_error=False)
        run_cmd("export DEBIAN_FRONTEND=noninteractive && apt-get install -y locales", fail_on_error=False)
        run_cmd("locale-gen en_US.UTF-8", fail_on_error=False)
        run_cmd("update-locale LANG=en_US.UTF-8", fail_on_error=False)
        run_cmd("export DEBIAN_FRONTEND=noninteractive && apt-get --purge remove -y postgresql*", fail_on_error=False)
        run_cmd("rm -rf /etc/postgresql /var/lib/postgresql /var/run/postgresql", fail_on_error=False)
        run_cmd("export DEBIAN_FRONTEND=noninteractive && apt-get install -y postgresql postgresql-contrib", fail_on_error=False)
        run_cmd("systemctl enable postgresql", fail_on_error=False)
        run_cmd("systemctl start postgresql", fail_on_error=False)
        
    db_name = "strix"
    db_user = "strix_user"
    # db_pass is generated/reused by get_db_password() — never hardcoded (H-2).

    print("Configuring Database and User...")
    # Use SCRAM password hashing (stronger than md5) for any password we set below.
    run_cmd("sudo -u postgres psql -c \"ALTER SYSTEM SET password_encryption = 'scram-sha-256';\"", fail_on_error=False)
    run_cmd("sudo -u postgres psql -c \"SELECT pg_reload_conf();\"", fail_on_error=False)

    # Using psql as postgres user
    run_cmd(f"sudo -u postgres psql -tc \"SELECT 1 FROM pg_database WHERE datname = '{db_name}'\" | grep -q 1 || sudo -u postgres psql -c \"CREATE DATABASE {db_name}\"", fail_on_error=False)
    run_cmd(f"sudo -u postgres psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='{db_user}'\" | grep -q 1 || sudo -u postgres psql -c \"CREATE USER {db_user} WITH ENCRYPTED PASSWORD '{db_pass}'\"", fail_on_error=False)
    # Force the password to the intended value (idempotent across re-runs; also
    # re-hashes an existing md5 password as scram-sha-256).
    run_cmd(f"sudo -u postgres psql -c \"ALTER USER {db_user} WITH ENCRYPTED PASSWORD '{db_pass}'\"", fail_on_error=False)
    run_cmd(f"sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE {db_name} TO {db_user}\"", fail_on_error=False)
    run_cmd(f"sudo -u postgres psql -c \"ALTER DATABASE {db_name} OWNER TO {db_user}\"", fail_on_error=False)

    # Force PostgreSQL to listen on TCP for Prisma to connect
    run_cmd("sudo -u postgres psql -c \"ALTER SYSTEM SET listen_addresses = '127.0.0.1';\"", fail_on_error=False)
    
    # Ensure password auth is allowed for localhost
    code, out = run_cmd("sudo -u postgres psql -t -c 'SHOW hba_file;'", fail_on_error=False)
    hba_path = out.strip()
    if code == 0 and hba_path and os.path.exists(hba_path):
        run_cmd(f"grep -q 'host all all 127.0.0.1/32 scram-sha-256' {hba_path} || echo 'host all all 127.0.0.1/32 scram-sha-256' | sudo tee -a {hba_path}", fail_on_error=False)
        
    print("Restarting PostgreSQL...")
    run_cmd("systemctl restart postgresql", fail_on_error=False)
    
    print("----- POSTGRESQL DEBUG INFO -----")
    c, out1 = run_cmd("systemctl status postgresql --no-pager", fail_on_error=False)
    print(out1)
    c, out2 = run_cmd("ss -tulpan | grep postgres", fail_on_error=False, shell=True)
    print(out2)
    c, out3 = run_cmd("sudo -u postgres psql -c 'SHOW port;'", fail_on_error=False)
    print(out3)
    print("---------------------------------")
    
    print_success("PostgreSQL configured successfully.")

def install_nodejs():
    print_step("Checking/Installing Node.js and npm...")
    code, out = run_cmd("node -v", fail_on_error=False)
    if code != 0 or not out.startswith("v20"):
        print("Installing Node.js LTS (v20)...")
        run_cmd("curl -fsSL https://deb.nodesource.com/setup_20.x | bash -")
        run_cmd("export DEBIAN_FRONTEND=noninteractive && apt-get install -y nodejs")
    else:
        print("Node.js v20 is already installed.")

    print("Checking PM2...")
    code, out = run_cmd("pm2 -v", fail_on_error=False)
    if code != 0:
        run_cmd("npm install -g pm2")
    else:
        print("PM2 is already installed.")
    print_success("Node.js and PM2 are ready.")

def strix_source_dir():
    """The patched Strix source vendored alongside the dashboard in this repo."""
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return os.path.join(root, "strix")


def strix_binary_path():
    """Where the built Strix CLI lives once the vendored source is synced."""
    return os.path.join(strix_source_dir(), ".venv", "bin", "strix")


def install_strix():
    print_step("Installing Strix Core (patched, from vendored source)...")

    strix_src = strix_source_dir()
    if not os.path.exists(os.path.join(strix_src, "pyproject.toml")):
        print_error(f"Vendored Strix source not found at {strix_src} (expected pyproject.toml).")
        print_error("This repo must ship the patched strix/ folder next to strix-dashboard/.")
        sys.exit(1)

    # The project is uv-managed with a lockfile; build it exactly like local dev.
    uv_bin = None
    code, out = run_cmd("command -v uv", fail_on_error=False)
    if code == 0 and out.strip():
        uv_bin = out.strip().splitlines()[-1].strip()
    if not uv_bin:
        print("Installing uv (Python package manager)...")
        run_cmd("curl -LsSf https://astral.sh/uv/install.sh | sh", fail_on_error=False)
        for cand in ["~/.local/bin/uv", "~/.cargo/bin/uv"]:
            p = os.path.expanduser(cand)
            if os.path.exists(p):
                uv_bin = p
                break
    if not uv_bin:
        print_error("Could not install or locate 'uv' (needed to build the vendored Strix).")
        sys.exit(1)

    # Build the in-tree venv from the locked dependencies.
    code, out = run_cmd(f"cd {strix_src} && {uv_bin} sync", fail_on_error=False)
    if code != 0:
        print_error("Failed to build Strix with 'uv sync'.")
        print(out)
        sys.exit(1)

    strix_bin = strix_binary_path()
    if not os.path.exists(strix_bin):
        print_error(f"Strix binary not found after build at {strix_bin}.")
        sys.exit(1)

    # Expose it globally for convenience; the dashboard pins STRIX_PATH to it too.
    run_cmd(f"ln -sf {strix_bin} /usr/local/bin/strix")

    code, out = run_cmd(f"{strix_bin} --help", fail_on_error=False)
    if code != 0:
        print_error("Failed to verify Strix installation (strix --help failed).")
        sys.exit(1)
    if "--false-positive-file" in out:
        print_success("Patched Strix Core installed (supports --false-positive-file).")
    else:
        print_error("Strix built, but the false-positive patch is missing — vendored source may be stale.")

def setup_dashboard(db_pass):
    print_step("Setting up Strix Dashboard...")
    dashboard_dir = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')), "strix-dashboard")
    if not os.path.exists(dashboard_dir):
        print_error(f"Dashboard directory not found at: {dashboard_dir}")
        sys.exit(1)
        
    env_file = os.path.join(dashboard_dir, ".env")
    code, out = run_cmd("sudo -u postgres psql -c 'SHOW port;' -t", fail_on_error=False)
    pg_port = out.strip() if code == 0 and out.strip().isdigit() else "5432"
    
    if not os.path.exists(env_file):
        import secrets
        print("Creating .env file with randomly generated secrets...")
        session_secret = secrets.token_hex(32)
        scheduler_secret = secrets.token_hex(32)
        with open(env_file, "w") as f:
            f.write(f"DATABASE_URL=\"postgresql://strix_user:{db_pass}@127.0.0.1:{pg_port}/strix?schema=public\"\n")
            f.write(f"SESSION_SECRET=\"{session_secret}\"\n")
            f.write(f"SCHEDULER_SECRET=\"{scheduler_secret}\"\n")
            f.write("INSECURE_HTTP=true\n")
            f.write("PORT=48080\n")
            f.write(f"STRIX_PATH=\"{strix_binary_path()}\"\n")
    else:
        # If it exists, ensure we fix the DATABASE_URL and ensure all required secrets exist
        import re
        import secrets as _secrets
        with open(env_file, "r") as f:
            content = f.read()
            
        new_db_url = f"DATABASE_URL=\"postgresql://strix_user:{db_pass}@127.0.0.1:{pg_port}/strix?schema=public\""
        if "DATABASE_URL" in content:
            content = re.sub(r'DATABASE_URL=.*', new_db_url, content)
        else:
            content += f"\n{new_db_url}\n"
            
        if "INSECURE_HTTP" not in content:
            content += "INSECURE_HTTP=true\n"
        
        # Ensure SESSION_SECRET exists (required for auth)
        if "SESSION_SECRET" not in content:
            content += f"SESSION_SECRET=\"{_secrets.token_hex(32)}\"\n"
            print("Generated missing SESSION_SECRET.")

        # Ensure SCHEDULER_SECRET exists (required for scheduled scans)
        if "SCHEDULER_SECRET" not in content:
            content += f"SCHEDULER_SECRET=\"{_secrets.token_hex(32)}\"\n"
            print("Generated missing SCHEDULER_SECRET.")

        # Ensure PORT is set so the embedded scheduler knows how to call back
        if "PORT=" not in content:
            content += "PORT=48080\n"
            print("Set PORT=48080 for scheduler daemon.")

        # Pin STRIX_PATH to the vendored, patched Strix build.
        strix_path_line = f"STRIX_PATH=\"{strix_binary_path()}\""
        if "STRIX_PATH=" in content:
            content = re.sub(r'STRIX_PATH=.*', strix_path_line, content)
        else:
            content += f"{strix_path_line}\n"
            print("Pinned STRIX_PATH to the vendored Strix build.")
            
        with open(env_file, "w") as f:
            f.write(content)
        print(f"Fixed database host and port ({pg_port}) in existing .env file.")
            
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
    dashboard_dir = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')), "strix-dashboard")
    
    # Kill any process on port 48080 to prevent EADDRINUSE
    run_cmd("fuser -k 48080/tcp", fail_on_error=False)
    
    # Delete existing pm2 process if it exists
    run_cmd("pm2 delete strix-dashboard", fail_on_error=False)

    # False-positive instructions must live OUTSIDE the repo so a redeploy
    # (git clone / rm -rf) never wipes them and the app never falls back to the
    # in-repo default. Passed into the PM2 process env so the running server
    # actually reads it (the app resolves FP_INSTRUCTIONS_DIR at runtime).
    fp_dir = os.environ.get("FP_INSTRUCTIONS_DIR", "/var/lib/strix/fp_instructions")
    run_cmd(f"mkdir -p '{fp_dir}'", fail_on_error=False)

    # Start the app via PM2.
    # Bind to 127.0.0.1 only: the app is meant to sit behind the Nginx reverse
    # proxy (443), so it must NOT be reachable directly from outside on 48080.
    print("Starting Next.js via PM2 on 127.0.0.1:48080...")
    run_cmd(f"cd {dashboard_dir} && FP_INSTRUCTIONS_DIR='{fp_dir}' pm2 start npm --name 'strix-dashboard' -- run start -- -H 127.0.0.1 -p 48080")
    
    # Save PM2 list and configure startup
    run_cmd("pm2 save")
    run_cmd("pm2 startup | tail -n 1 | bash", fail_on_error=False)
    
    print_success("Deployment completed successfully. The application is running in the background.")

def main():
    print(f"\n{Colors.OKCYAN}{Colors.BOLD}=== STRIX GLOBAL AUTO-DEPLOYER ==={Colors.ENDC}\n")
    check_root()
    install_system_packages()
    db_pass = get_db_password()
    setup_postgresql(db_pass)
    install_nodejs()
    install_strix()
    setup_dashboard(db_pass)
    deploy_service()
    
    print(f"\n{Colors.OKGREEN}{Colors.BOLD}🎉 ALL DONE! Strix is now live.{Colors.ENDC}")
    print(f"\n{Colors.OKCYAN}{Colors.BOLD}=== USEFUL COMMANDS ==={Colors.ENDC}")
    print(f"{Colors.BOLD}Dashboard UI:{Colors.ENDC}    http://<your-server-ip>")
    print(f"{Colors.BOLD}App Logs:{Colors.ENDC}        sudo pm2 logs strix-dashboard")
    print(f"{Colors.BOLD}App Status:{Colors.ENDC}      sudo pm2 status")
    print(f"{Colors.BOLD}Restart App:{Colors.ENDC}     sudo pm2 restart strix-dashboard")
    print(f"{Colors.BOLD}Database CLI:{Colors.ENDC}    sudo -u postgres psql -d strix")
    print(f"{Colors.BOLD}Test Strix CLI:{Colors.ENDC}  strix --help\n")

if __name__ == "__main__":
    main()
