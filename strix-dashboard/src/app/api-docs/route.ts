// Route handler — serves a full standalone HTML page with Swagger UI loaded from CDN
// This avoids any npm package dependency (swagger-ui-react) on the server
import { NextResponse } from "next/server";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8" />
 <meta name="viewport" content="width=device-width, initial-scale=1.0" />
 <title>Strix API Docs — Swagger UI</title>
 <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
 <style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
   font-family: 'Inter', sans-serif;
   background: #0d1117;
   color: #fff;
   min-height: 100vh;
  }
  .top-bar {
   background: #111827;
   border-bottom: 1px solid #374151;
   padding: 14px 24px;
   display: flex;
   align-items: center;
   justify-content: space-between;
   position: sticky;
   top: 0;
   z-index: 100;
  }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo span:first-child { font-size: 1.5rem; }
  .logo-text { font-size: 1.1rem; font-weight: 700; color: #fff; }
  .logo-sub { font-size: 0.78rem; color: #9CA3AF; margin-top: 1px; }
  .header-links { display: flex; gap: 10px; }
  .header-links a {
   padding: 6px 14px;
   border-radius: 7px;
   font-size: 0.8rem;
   font-weight: 600;
   text-decoration: none;
   transition: all 0.15s;
  }
  .link-raw {
   background: rgba(255,255,255,0.05);
   border: 1px solid rgba(255,255,255,0.1);
   color: rgba(255,255,255,0.7);
  }
  .link-raw:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .link-health {
   background: rgba(0,230,118,0.1);
   border: 1px solid rgba(0,230,118,0.25);
   color: #00e676;
  }
  .link-health:hover { background: rgba(0,230,118,0.2); }
  .link-back {
   background: rgba(255,255,255,0.03);
   border: 1px solid rgba(255,255,255,0.08);
   color: #9CA3AF;
  }
  .link-back:hover { color: #fff; }
  #swagger-ui { padding: 24px; }

  /* Dark-mode overrides for Swagger UI */
  .swagger-ui { filter: invert(88%) hue-rotate(180deg); background: transparent; }
  .swagger-ui .highlight-code *,
  .swagger-ui .microlight,
  .swagger-ui .opblock-body pre,
  .swagger-ui textarea { filter: invert(100%) hue-rotate(180deg); }
  .swagger-ui .topbar { display: none; }
 </style>
</head>
<body>
 <div class="top-bar">
  <div class="logo">
   <span></span>
   <div>
    <div class="logo-text">Strix API Docs</div>
    <div class="logo-sub">Interactive REST API documentation</div>
   </div>
  </div>
  <div class="header-links">
   <a href="/" class="link-back">← Dashboard</a>
   <a href="/api/docs" target="_blank" class="link-raw"> Raw JSON</a>
   <a href="/api/health" target="_blank" class="link-health"> Health</a>
  </div>
 </div>
 <div id="swagger-ui"></div>
 <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
 <script>
  SwaggerUIBundle({
   url: '/api/docs',
   dom_id: '#swagger-ui',
   presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
   layout: 'BaseLayout',
   docExpansion: 'list',
   defaultModelsExpandDepth: 2,
   displayRequestDuration: true,
   tryItOutEnabled: true,
   filter: true,
   persistAuthorization: true,
  });
 </script>
</body>
</html>`;

export async function GET() {
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
