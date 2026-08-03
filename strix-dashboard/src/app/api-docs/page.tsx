"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import styles from "./swagger.module.css";

// Must be dynamically imported with SSR disabled — swagger-ui-react uses browser APIs
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>⚡</span>
          <div>
            <h1 className={styles.title}>Strix API Docs</h1>
            <p className={styles.subtitle}>Interactive REST API documentation</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.rawLink}
          >
            📄 Raw OpenAPI JSON
          </a>
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.healthLink}
          >
            🟢 Health Check
          </a>
        </div>
      </div>

      <div className={styles.swaggerWrapper}>
        <SwaggerUI
          url="/api/docs"
          docExpansion="list"
          defaultModelsExpandDepth={2}
          displayRequestDuration={true}
          tryItOutEnabled={true}
          filter={true}
          persistAuthorization={true}
        />
      </div>
    </div>
  );
}
