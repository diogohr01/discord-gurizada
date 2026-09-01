import styles from "@/components/nexus.module.css";
import { appConfig } from "@/config/app";
import type { MouseEventHandler } from "react";

export function NexusMark({ compact = false, onTripleClick }: { compact?: boolean; onTripleClick?: MouseEventHandler<HTMLDivElement> }) {
  return (
    <div
      className={compact ? styles.brandCompact : styles.brand}
      aria-label={appConfig.name}
      onClick={(event) => { if (event.detail === 3) onTripleClick?.(event); }}
    >
      <span className={styles.brandIcon} aria-hidden>
        <svg viewBox="0 0 32 32" role="img">
          <path d="M7 24V8l9 8 9-8v16l-9-8-9 8Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="2.2" fill="currentColor" />
        </svg>
      </span>
      {!compact && <span className={styles.brandWord}>{appConfig.name}</span>}
    </div>
  );
}
