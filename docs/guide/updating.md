# Updating Strix

As Project Strix is continuously developed, you may want to pull the latest changes, features, and security patches from the GitHub repository to your production server.

## The Auto-Deployer Method

The easiest and safest way to update your Strix deployment is to use the exact same script you used to install it. The `runner/deploy.py` script is idempotent, meaning it is perfectly safe to run multiple times. It will automatically detect existing configurations, apply any new database schema migrations, and rebuild the UI.

1. SSH into your server.
2. Navigate to your installation directory:
   ```bash
   cd ~/ProjectStrix
   ```
3. Fetch the latest code from the main branch and reset your local copy:
   ```bash
   sudo git fetch origin
   sudo git reset --hard origin/main
   ```
4. Run the auto-deployer script:
   ```bash
   sudo python3 runner/deploy.py
   ```

The script will:
- Check if your system dependencies (Node.js, Postgres) are still up to date.
- Install any new NPM packages added in the update.
- Apply new Prisma database migrations seamlessly (using `db push`).
- Compile the new Next.js dashboard.
- Gracefully restart the PM2 processes.

## Important Note on Data Loss
Using `runner/deploy.py` will run `npx prisma db push --accept-data-loss`. In development phases, this is perfectly fine. However, if structural schema changes occur that delete tables or columns, this command *could* result in data loss for those specific columns. Always back up your PostgreSQL database before updating critical production environments!
