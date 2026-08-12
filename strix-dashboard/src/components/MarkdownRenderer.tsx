import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy } from "lucide-react";
import 'katex/dist/katex.min.css';

export const MarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <div className="markdown-body" style={{ color: "var(--fg-1)", fontSize: 13, lineHeight: 1.7 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ children }: any) => {
            const codeChild = React.Children.toArray(children)[0] as any;
            const className = codeChild?.props?.className || "";
            const match = /language-(\w+)/.exec(className);
            const language = match ? match[1] : "";
            const codeString = String(codeChild?.props?.children || "").replace(/\n$/, "");
            
            return (
              <div style={{ background: "#1e1e1e", borderRadius: 8, overflow: "hidden", margin: "16px 0", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", background: "#252526", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "#858585", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {language || "TEXT"}
                  </span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(codeString)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#858585", cursor: "pointer", fontSize: 11, transition: "color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                    onMouseLeave={e => e.currentTarget.style.color = "#858585"}
                  >
                    <Copy size={13} /> Copy
                  </button>
                </div>
                <div style={{ padding: "12px" }}>
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={language || "text"}
                    PreTag="div"
                    customStyle={{ background: "transparent", padding: 0, margin: 0, overflow: "visible" }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              </div>
            );
          },
          code: ({ node, className, children, ...props }: any) => {
            return (
              <code className={className} style={{ color: "#ff4d4d", background: "rgba(255, 77, 77, 0.15)", padding: "3px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: "0.9em", border: "1px solid rgba(255, 77, 77, 0.3)" }} {...props}>
                {children}
              </code>
            );
          },
          h1: ({node, ...props}) => <h1 style={{ fontSize: "1.8em", fontWeight: 700, margin: "24px 0 16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px", color: "var(--fg)" }} {...props} />,
          h2: ({node, ...props}) => <h2 style={{ fontSize: "1.4em", fontWeight: 600, margin: "20px 0 16px", borderBottom: "1px solid var(--border)", paddingBottom: "6px", color: "var(--fg)" }} {...props} />,
          h3: ({node, ...props}) => <h3 style={{ fontSize: "1.2em", fontWeight: 600, margin: "16px 0", color: "var(--fg)" }} {...props} />,
          p: ({node, ...props}) => <p style={{ margin: "0 0 12px 0", lineHeight: 1.7 }} {...props} />,
          ul: ({node, ...props}) => <ul style={{ margin: "0 0 12px 0", paddingLeft: "24px", listStyleType: "disc" }} {...props} />,
          ol: ({node, ...props}) => <ol style={{ margin: "0 0 12px 0", paddingLeft: "24px", listStyleType: "decimal" }} {...props} />,
          li: ({node, ...props}) => <li style={{ margin: "4px 0" }} {...props} />,
          blockquote: ({node, ...props}) => <blockquote style={{ margin: "16px 0", padding: "8px 16px", borderLeft: "4px solid var(--brand)", background: "var(--bg-2)", color: "var(--fg-2)", borderRadius: "0 4px 4px 0" }} {...props} />,
          a: ({node, ...props}) => <a style={{ color: "var(--brand)", textDecoration: "underline", textUnderlineOffset: 3 }} {...props} />,
          hr: ({node, ...props}) => <hr style={{ height: 1, background: "var(--border)", border: "none", margin: "24px 0" }} {...props} />,
          table: ({node, ...props}) => <div style={{ overflowX: "auto", marginBottom: 16 }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }} {...props} /></div>,
          th: ({node, ...props}) => <th style={{ border: "1px solid var(--border)", padding: "8px 16px", background: "var(--bg-2)", fontWeight: 600, color: "var(--fg)" }} {...props} />,
          td: ({node, ...props}) => <td style={{ border: "1px solid var(--border)", padding: "8px 16px", color: "var(--fg-2)" }} {...props} />,
          img: ({node, ...props}) => <img style={{ maxWidth: "100%", borderRadius: 6, margin: "16px 0", border: "1px solid var(--border)" }} {...props} />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
