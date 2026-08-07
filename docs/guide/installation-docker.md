# Docker Deployment

*(Note: Official Docker support is currently in experimental phases. For production environments, we highly recommend using the `global_deploy.py` script on a native Linux host as described in the Ubuntu deployment guide.)*

If you prefer containerized environments, you can run Project Strix using Docker Compose. This encapsulates the Next.js frontend, the Python agent runner, and PostgreSQL into isolated containers.

## Prerequisites
- Docker Engine
- Docker Compose v2

## Deployment

1. Clone the repository:
   ```bash
   git clone https://github.com/infat0x/ProjectStrix.git
   cd ProjectStrix
   ```

2. Create a `docker-compose.yml` (Example configuration):
   ```yaml
   version: '3.8'
   services:
     db:
       image: postgres:15-alpine
       environment:
         POSTGRES_USER: strix_user
         POSTGRES_PASSWORD: strix_password_123
         POSTGRES_DB: strix
       volumes:
         - strix-db-data:/var/lib/postgresql/data
       ports:
         - "5432:5432"

     strix-dashboard:
       build: 
         context: .
         dockerfile: Dockerfile
       ports:
         - "48080:80"
       environment:
         DATABASE_URL: "postgresql://strix_user:strix_password_123@db:5432/strix?schema=public"
       depends_on:
         - db

   volumes:
     strix-db-data:
   ```

3. Start the containers:
   ```bash
   docker-compose up -d
   ```

4. The dashboard will be accessible at `http://localhost:48080`.
