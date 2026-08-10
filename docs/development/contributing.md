# Contributing & Development

Want to improve the Strix Dashboard or fix a bug? We welcome contributions! Here is how to set up the development environment on your local machine.

## 1. Prerequisites

- Node.js v20+
- PostgreSQL (Local or Docker)
- Python 3.10+

## 2. Setting up the Dashboard locally

1. Fork and clone the repository.
2. Navigate to the frontend directory:
   ```bash
   cd strix-dashboard
   ```
3. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
4. Create a `.env` file in `strix-dashboard/`:
   ```env
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/strix?schema=public"
   SESSION_SECRET="dev-secret-key"
   WEBHOOK_SECRET="dev-webhook-secret"
   ```
5. Apply database migrations:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```

## 3. Database Management (Prisma Studio)

If you need to inspect the database, manually create an `admin` user, or delete stuck scans, use Prisma Studio.

```bash
cd strix-dashboard
npx prisma studio
```
This will open a visual database editor at `http://localhost:5555`.

## 4. Submitting a Pull Request

- Follow the existing code style (Tailwind CSS, React Server Components).
- Create a new branch (`git checkout -b feature/awesome-new-graph`).
- Commit your changes and push to your fork.
- Open a Pull Request on GitHub.
