# Installation & Setup

Follow these steps to deploy Project Strix in a development or production environment (e.g., Ubuntu VM).

## Prerequisites
- **Node.js**: v20+ 
- **Python**: v3.10+ (for Strix Core)
- **PostgreSQL**: v14+
- **PM2**: Global installation (`npm install -g pm2`)
- **Git**

## 1. Clone the Repository
```bash
git clone https://github.com/infat0x/ProjectStrix.git
cd ProjectStrix
```

## 2. Environment Variables
Create a `.env` file in the `strix-dashboard` directory:
```env
DATABASE_URL="postgresql://strixuser:your_password_here@localhost:5432/strix?schema=public"
JWT_SECRET="your-super-secure-secret-key"
```

## 3. Starting the Application (The Easy Way)
We provide a convenient shell script to handle port cleanup, dependency installation, database synchronization, and starting both the Next.js server and PM2 scheduler.

```bash
cd ~/ProjectStrix
chmod +x start_dev.sh
./start_dev.sh
```

**What `start_dev.sh` does:**
1. Kills any zombie processes holding port 80.
2. Clears out any old PM2 processes.
3. Automatically runs `npm install` and `npx prisma generate` to keep dependencies and database schemas synchronized.
4. Pushes the latest Prisma schema to PostgreSQL.
5. Starts the `strix-scheduler` background worker via PM2.
6. Starts the Next.js frontend on port 80 (`0.0.0.0:80`).

The dashboard will now be accessible at `http://<your-server-ip>:80`.

## 4. Manual Start (Optional)
If you prefer to start things manually without the script:

```bash
cd ~/ProjectStrix/strix-dashboard

# Install and sync DB
npm install
npx prisma generate
npx prisma db push --accept-data-loss

# Start background scheduler
pm2 start scripts/scheduler.js --name "strix-scheduler"
pm2 save

# Start UI
sudo npm run dev -- -H 0.0.0.0 -p 80
```
