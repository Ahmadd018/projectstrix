# Authentication

Security tools must inherently be secure themselves. Project Strix uses a **stateless, cookie-based JSON Web Token (JWT)** architecture for authentication. This ensures the dashboard remains fast, scalable, and independent of server-side session memory.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#dc2626', 'edgeLabelBackground':'#1e1e20', 'tertiaryColor': '#1e1e20'}}}%%
sequenceDiagram
    participant Browser
    participant API as Next.js API (/api/auth)
    participant DB as PostgreSQL

    Browser->>API: POST /login (username, password)
    API->>DB: Query User & Verify Hash
    DB-->>API: Valid Credentials
    API->>API: Generate JWT (Signed with JWT_SECRET)
    API-->>Browser: Set-Cookie: strix_session=...; HttpOnly
    
    note over Browser,API: Future Requests
    Browser->>API: GET /api/scans (includes HttpOnly Cookie)
    API->>API: Verify JWT Signature
    API-->>Browser: Return Scan Data
```

## How It Works

Strix uses **JSON Web Tokens (JWT)** for session management. We do not store sessions in the database to reduce overhead and improve API response times. Instead, the JWT is cryptographically signed using the `JWT_SECRET` defined in your `.env` file.

### Login Flow
1. A user submits their username and password to the `/api/auth/login` endpoint.
2. The backend uses `bcrypt` to securely verify the hashed password against the database.
3. Upon success, a JWT is generated via the `jose` library.
4. The JWT is sent back to the client in an **HTTP-only, Secure, SameSite=Strict** cookie named `strix_session`.

### Security Mechanisms
- **HTTP-Only:** The session cookie cannot be accessed via JavaScript (`document.cookie`), completely mitigating Cross-Site Scripting (XSS) attacks aimed at stealing sessions.
- **SameSite=Strict:** The cookie is only sent in first-party contexts, protecting against Cross-Site Request Forgery (CSRF).
- **Stateless Validation:** Every API request validates the JWT signature mathematically without needing to hit the database.

## Registration

By default, anyone who can reach the login page can register an account. However, regular users have restricted access (see Role-Based Access Control).

If you are exposing Strix to the public internet, it is **highly recommended** to place it behind a WAF, VPN, or reverse proxy with Basic Auth, or to disable the registration endpoint in the Next.js API (`src/app/api/auth/register/route.ts`) after you have created your initial accounts.
