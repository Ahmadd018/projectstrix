"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, X, AlertCircle, FileText, Radar, FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  target: string;
  projectName: string;
  status: string;
  createdAt: string;
  matchedFields: string[];
  snippet: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen) {
          // Open via a custom event if we want, but since state is lifted, 
          // we might just rely on the parent or trigger a custom event.
          // For now, we handle closing and navigation inside the modal.
        }
      }
      
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        handleSelectResult(results[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setResults([]);
      setError(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          throw new Error("Search failed");
        }
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, isOpen]);

  const handleSelectResult = (result: SearchResult) => {
    onClose();
    // Navigate to the scan details or the scans page with the specific scan open
    // Since our app opens scan details in a dialog or expands it, we can just go to /scans?id=xxx
    router.push(`/scans?id=${result.id}`);
  };

  if (!isOpen) return null;

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div 
        className="global-search-modal animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search scans, targets, projects, or vulnerabilities..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input"
          />
          {isLoading && <Loader2 className="search-spinner spin" size={18} />}
          <button className="search-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="search-results-container">
          {error && (
            <div className="search-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && query.trim().length > 1 && results.length === 0 && (
            <div className="search-empty">
              <Search size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No results found for "{query}"</p>
            </div>
          )}

          {!isLoading && !error && query.trim().length <= 1 && (
            <div className="search-empty">
              <p style={{ opacity: 0.5 }}>Type at least 2 characters to search</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="search-results-list">
              <div className="search-results-header">SCANS & VULNERABILITIES</div>
              {results.map((result, idx) => (
                <div 
                  key={result.id} 
                  className={`search-result-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSelectResult(result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="result-icon-wrapper">
                    {result.matchedFields.includes("projectName") ? <FolderOpen size={16} /> : <Radar size={16} />}
                  </div>
                  <div className="result-content">
                    <div className="result-title">
                      <span className="result-target">{result.target}</span>
                      {result.projectName && (
                        <span className="result-project-badge">{result.projectName}</span>
                      )}
                    </div>
                    <div className="result-snippet">
                      {result.snippet}
                    </div>
                    <div className="result-meta">
                      <span className="result-status" data-status={result.status}>
                        {result.status}
                      </span>
                      <span className="result-date">
                        {new Date(result.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="search-footer">
          <div className="search-hint">
            <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
            <span><kbd>Enter</kbd> to select</span>
            <span><kbd>Esc</kbd> to close</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .global-search-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 12vh;
        }

        .global-search-modal {
          width: 100%;
          max-width: 640px;
          background: var(--bg-1);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .search-input-wrapper {
          display: flex;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          position: relative;
        }

        .search-icon {
          color: var(--fg-3);
          margin-right: 12px;
        }

        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 18px;
          color: var(--fg);
          font-family: inherit;
        }

        .search-input::placeholder {
          color: var(--fg-3);
        }

        .search-spinner {
          color: var(--brand);
          margin-right: 12px;
        }

        .search-close-btn {
          background: var(--bg-2);
          border: 1px solid var(--border);
          color: var(--fg-2);
          border-radius: 6px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .search-close-btn:hover {
          background: var(--bg-3);
          color: var(--fg);
        }

        .search-results-container {
          max-height: 400px;
          overflow-y: auto;
          padding: 8px 0;
        }

        .search-empty {
          padding: 48px 20px;
          text-align: center;
          color: var(--fg-3);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .search-error {
          padding: 16px 20px;
          color: var(--sev-high);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .search-results-header {
          padding: 8px 20px;
          font-size: 11px;
          font-weight: 600;
          color: var(--fg-3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .search-result-item {
          display: flex;
          gap: 16px;
          padding: 12px 20px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .search-result-item.selected {
          background: var(--bg-2);
        }

        .result-icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--bg-3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--fg-2);
          flex-shrink: 0;
        }

        .search-result-item.selected .result-icon-wrapper {
          background: var(--brand);
          color: #fff;
        }

        .result-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .result-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .result-target {
          font-weight: 500;
          color: var(--fg);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .result-project-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.1);
          color: var(--fg-2);
          border: 1px solid var(--border);
          white-space: nowrap;
        }

        .result-snippet {
          font-size: 13px;
          color: var(--fg-2);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .result-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 11px;
          color: var(--fg-3);
          margin-top: 2px;
        }

        .result-status {
          text-transform: capitalize;
        }
        
        .result-status[data-status="running"],
        .result-status[data-status="crawling"],
        .result-status[data-status="scanning"],
        .result-status[data-status="analyzing"] {
          color: var(--brand);
        }
        
        .result-status[data-status="completed"] {
          color: #10b981;
        }
        
        .result-status[data-status="failed"] {
          color: var(--sev-critical);
        }

        .search-footer {
          padding: 12px 20px;
          border-top: 1px solid var(--border);
          background: var(--bg-0);
          display: flex;
          justify-content: flex-end;
        }

        .search-hint {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: var(--fg-3);
        }

        .search-hint span {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        kbd {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 2px 6px;
          font-family: monospace;
          font-size: 10px;
          color: var(--fg-2);
          box-shadow: 0 1px 0 var(--border);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
