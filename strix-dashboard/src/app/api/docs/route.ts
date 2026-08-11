import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Strix Security Dashboard API",
    description:
      "REST API for the Strix AI Penetration Testing Dashboard. Allows launching scans, monitoring results in real-time via SSE, and retrieving vulnerability findings.",
    version: "1.0.0",
    contact: {
      name: "Project Strix",
      url: "https://github.com/infat0x/ProjectStrix",
    },
  },
  servers: [{ url: "/api", description: "Current server" }],
  tags: [
    { name: "Health", description: "API health and system status" },
    { name: "Auth", description: "Authentication and User Registration" },
    { name: "Scans", description: "Security scan management" },
    { name: "Logs", description: "System audit logs" },
    {
      name: "Streaming",
      description: "Real-time scan output via Server-Sent Events",
    },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description:
          "Returns the health status of the API, strix CLI availability, storage status, and running scan count.",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "System is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
                example: {
                  status: "ok",
                  timestamp: "2026-08-03T12:00:00.000Z",
                  uptime_seconds: 3600,
                  version: "1.0.0",
                  components: {
                    api: { status: "ok", message: "Next.js API is running" },
                    strix_cli: {
                      status: "ok",
                      path: "/usr/local/bin/strix",
                      message: "strix found",
                    },
                    storage: {
                      status: "ok",
                      runs_dir: "/app/strix_runs",
                      runs_dir_exists: true,
                      total_scans: 5,
                      running_scans: 1,
                    },
                  },
                },
              },
            },
          },
          "503": { description: "System is unhealthy" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login user",
        description: "Authenticates a user and sets a session cookie.",
        operationId: "loginUser",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Successfully authenticated" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register user",
        description: "Creates a new user and auto-logs them in.",
        operationId: "registerUser",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Successfully registered" },
          "400": { description: "Validation error" },
          "409": { description: "Username already exists" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user profile",
        description: "Returns the profile of the currently authenticated user.",
        operationId: "getMe",
        responses: {
          "200": { description: "User profile returned successfully" },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout user",
        description: "Destroys the current user session.",
        operationId: "logoutUser",
        responses: {
          "200": { description: "Logged out successfully" },
        },
      },
    },
    "/user/settings": {
      get: {
        tags: ["Auth"],
        summary: "Get user settings",
        description: "Retrieves account settings for the authenticated user.",
        operationId: "getUserSettings",
        responses: {
          "200": { description: "User settings returned" },
        },
      },
    },
    "/analytics": {
      get: {
        tags: ["Logs"],
        summary: "Get dashboard analytics",
        description: "Retrieves statistical data for the dashboard charts.",
        operationId: "getAnalytics",
        responses: {
          "200": { description: "Analytics data returned successfully" },
        },
      },
    },
    "/logs": {
      get: {
        tags: ["Logs"],
        summary: "Get system logs",
        description: "Retrieves recent system events. ADMIN role required.",
        operationId: "getLogs",
        responses: {
          "200": { description: "List of system logs" },
          "403": { description: "Forbidden - Requires ADMIN role" },
        },
      },
    },
    "/scans": {
      get: {
        tags: ["Scans"],
        summary: "List all scans",
        description:
          "Returns a list of all scans sorted by start time (newest first), each with status and vulnerability count.",
        operationId: "listScans",
        responses: {
          "200": {
            description: "List of scans",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    scans: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ScanSummary" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Scans"],
        summary: "Launch a new scan",
        description:
          "Starts a new Strix security assessment against the given target. The scan runs asynchronously in the background. If the strix CLI is not installed, the scan runs in demo mode with mock vulnerability data.",
        operationId: "createScan",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateScanRequest" },
              example: {
                target: "https://your-app.com",
                llmModel: "openai/gpt-4o",
                apiKey: "sk-your-api-key",
                scanMode: "standard",
                instruction: "Focus on authentication and IDOR vulnerabilities",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Scan started successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateScanResponse" },
                example: {
                  scanId: "uuid-here",
                  status: "running",
                  mode: "live",
                },
              },
            },
          },
          "400": {
            description: "Bad request — target or apiKey missing",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/scans/{id}": {
      get: {
        tags: ["Scans"],
        summary: "Get scan details",
        description:
          "Returns the full scan metadata including status, model used, timestamps, and all discovered vulnerabilities.",
        operationId: "getScan",
        parameters: [{ $ref: "#/components/parameters/ScanId" }],
        responses: {
          "200": {
            description: "Scan detail with vulnerabilities",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScanDetail" },
              },
            },
          },
          "404": { description: "Scan not found" },
        },
      },
      delete: {
        tags: ["Scans"],
        summary: "Stop a running scan",
        description:
          "Sends SIGTERM to the running scan process and marks it as stopped.",
        operationId: "stopScan",
        parameters: [{ $ref: "#/components/parameters/ScanId" }],
        responses: {
          "200": {
            description: "Scan stopped",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                },
                example: { success: true },
              },
            },
          },
          "404": { description: "Scan not found" },
        },
      },
    },
    "/scans/bulk": {
      delete: {
        tags: ["Scans"],
        summary: "Bulk delete scans",
        description: "Deletes multiple scans by their IDs.",
        operationId: "bulkDeleteScans",
        responses: {
          "200": { description: "Scans deleted successfully" },
        },
      },
    },
    "/scans/{id}/schedule": {
      post: {
        tags: ["Scans"],
        summary: "Schedule a scan",
        description: "Sets a recurring schedule for a specific scan configuration.",
        operationId: "scheduleScan",
        parameters: [{ $ref: "#/components/parameters/ScanId" }],
        responses: {
          "200": { description: "Scan scheduled successfully" },
        },
      },
    },
    "/scans/{id}/stream": {
      get: {
        tags: ["Streaming"],
        summary: "Real-time scan log stream (SSE)",
        description:
          "Server-Sent Events stream that delivers live agent log lines and discovered vulnerabilities as the scan runs. On first connect, replays existing log history. Sends a final `status` event when the scan finishes.\n\n**Event types:**\n- `log` — a single line from the agent output\n- `vulnerability` — a newly discovered vulnerability object\n- `status` — scan finished (`completed` | `failed` | `stopped`)",
        operationId: "streamScan",
        parameters: [{ $ref: "#/components/parameters/ScanId" }],
        responses: {
          "200": {
            description: "SSE stream",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  example:
                    'data: {"type":"log","line":"[2026-08-03T12:00:00Z] Starting scan..."}\n\ndata: {"type":"vulnerability","vuln":{...}}\n\ndata: {"type":"status","status":"completed"}\n\n',
                },
              },
            },
          },
          "404": { description: "Scan not found" },
        },
      },
    },
  },
  components: {
    parameters: {
      ScanId: {
        name: "id",
        in: "path",
        required: true,
        description: "Scan UUID (returned when scan was created)",
        schema: {
          type: "string",
          format: "uuid",
          example: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
    },
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ok", "degraded", "error"] },
          timestamp: { type: "string", format: "date-time" },
          uptime_seconds: { type: "integer" },
          version: { type: "string" },
          components: {
            type: "object",
            properties: {
              api: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  message: { type: "string" },
                },
              },
              strix_cli: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["ok", "not_installed"] },
                  path: { type: "string", nullable: true },
                  message: { type: "string" },
                },
              },
              storage: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  runs_dir: { type: "string" },
                  runs_dir_exists: { type: "boolean" },
                  total_scans: { type: "integer" },
                  running_scans: { type: "integer" },
                },
              },
            },
          },
        },
      },
      CreateScanRequest: {
        type: "object",
        required: ["target", "apiKey"],
        properties: {
          target: {
            type: "string",
            description:
              "Target URL, GitHub repository URL, or local directory path",
            example: "https://your-app.com",
          },
          llmModel: {
            type: "string",
            description: "LLM provider/model string in litellm format",
            default: "openai/gpt-4o",
            example: "anthropic/claude-sonnet-4-5",
          },
          apiKey: {
            type: "string",
            description:
              "API key for the selected LLM provider (never stored on disk)",
            example: "sk-...",
          },
          scanMode: {
            type: "string",
            enum: ["quick", "standard", "deep"],
            default: "standard",
            description: "Scan thoroughness level",
          },
          instruction: {
            type: "string",
            description: "Optional custom instructions for the scan agents",
            example:
              "Focus on authentication bypasses and IDOR. Use credentials: admin/password123",
          },
        },
      },
      CreateScanResponse: {
        type: "object",
        properties: {
          scanId: {
            type: "string",
            format: "uuid",
            description: "Unique scan identifier",
          },
          status: { type: "string", enum: ["running"] },
          mode: {
            type: "string",
            enum: ["live", "demo"],
            description:
              "live = real strix process; demo = mock data (strix not installed)",
          },
        },
      },
      ScanSummary: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          target: { type: "string" },
          llmModel: { type: "string" },
          scanMode: { type: "string", enum: ["quick", "standard", "deep"] },
          status: {
            type: "string",
            enum: ["running", "completed", "failed", "stopped"],
          },
          startedAt: { type: "string", format: "date-time" },
          finishedAt: { type: "string", format: "date-time", nullable: true },
          exitCode: { type: "integer", nullable: true },
          vulnCount: {
            type: "integer",
            description: "Number of discovered vulnerabilities",
          },
        },
      },
      ScanDetail: {
        allOf: [
          { $ref: "#/components/schemas/ScanSummary" },
          {
            type: "object",
            properties: {
              instruction: { type: "string" },
              vulnerabilities: {
                type: "array",
                items: { $ref: "#/components/schemas/Vulnerability" },
              },
            },
          },
        ],
      },
      Vulnerability: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string", example: "SQL Injection in /api/login" },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          endpoint: { type: "string", example: "/api/login" },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          description: { type: "string" },
          poc: {
            type: "string",
            description: "Proof of Concept — reproduction steps or payload",
          },
          cvss: {
            type: "number",
            format: "float",
            minimum: 0,
            maximum: 10,
            example: 9.8,
          },
          remediation: { type: "string" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "target is required" },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
