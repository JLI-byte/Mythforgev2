/**
 * Sprint 48B extraction — shared between WorldBibleEntry and ArticleReadView
 */
import React from 'react';
import { ArticleBlock } from '@/store/workspaceStore';
import styles from './WorldBibleEntry.module.css';
import { GridWidget, ArticleTab, parseArticleTabs } from './ArticleGridEditor';

/**
 * ArticleViewer — Read-only renderer for article blocks.
 */
export function ArticleViewer({ blocks }: { blocks: ArticleBlock[] }) {
    return (
        <div className={styles.articleViewer}>
            {blocks.slice().sort((a, b) => (a.y ?? 0) - (b.y ?? 0)).map(block => (
                <div key={block.id} className={styles.viewerBlock}>
                    <ViewerBlockRenderer block={block} />
                </div>
            ))}
        </div>
    );
}

/** 
 * Routes read-only block rendering
 */
export function ViewerBlockRenderer({ block }: { block: ArticleBlock }) {
    const { type, content } = block;

    switch (type) {
        case 'richtext':
            return (
                <div 
                    className={styles.viewerRichtext}
                    dangerouslySetInnerHTML={{ __html: content.html || '' }} 
                />
            );
        case 'image':
            return (
                <figure className={styles.viewerFigure}>
                    {content.src && <img src={content.src} alt={content.caption || ''} />}
                    {content.caption && <figcaption className={styles.viewerCaption}>{content.caption}</figcaption>}
                </figure>
            );
        case 'statrow':
            return (
                <div className={styles.viewerStatRow}>
                    <span className={styles.viewerStatLabel}>{content.label}</span>
                    <span className={styles.viewerStatValue}>{content.value}</span>
                </div>
            );
        case 'divider':
            return <hr className={styles.viewerDivider} />;
        case 'quote':
            return (
                <blockquote className={styles.viewerQuote}>
                    <p>{content.text}</p>
                    {content.attribution && <cite>— {content.attribution}</cite>}
                </blockquote>
            );
        case 'timeline':
            return (
                <div className={styles.viewerTimeline}>
                    {(content.events || []).map((event: any, i: number) => (
                        <div key={i} className={styles.viewerTimelineEvent}>
                            <div className={styles.viewerTimelineSidebar}>
                                <div className={styles.viewerTimelineDot} />
                                <div className={styles.viewerTimelineLine} />
                            </div>
                            <div className={styles.viewerEventContent}>
                                <div className={styles.viewerEventHeader}>
                                    <span className={styles.viewerEventDate}>{event.date}</span>
                                    <span className={styles.viewerEventLabel}>{event.label}</span>
                                </div>
                                {event.detail && <p className={styles.viewerEventDetail}>{event.detail}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            );
        default:
            return null;
    }
}

/**
 * Read-only renderer for a single GridWidget (Sprint 59 tab system).
 */
function GridWidgetReadRenderer({ widget }: { widget: GridWidget }) {
  const { type, content } = widget;
  switch (type) {
    case 'text':
      return (
        <div
          style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--foreground)' }}
          dangerouslySetInnerHTML={{ __html: content.html || '' }}
        />
      );
    case 'heading': {
      const Tag = (`h${content.level || 2}`) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return <Tag style={{ margin: '0 0 4px', color: 'var(--foreground)' }}>{content.text}</Tag>;
    }
    case 'image':
      return content.src ? (
        <figure style={{ margin: 0 }}>
          <img
            src={content.src}
            alt={content.caption || ''}
            style={{ width: '100%', height: 'auto', borderRadius: 6, display: 'block' }}
          />
          {content.caption && (
            <figcaption style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
              {content.caption}
            </figcaption>
          )}
        </figure>
      ) : null;
    case 'divider':
      return <hr style={{ border: 'none', height: 1, background: 'var(--border)', margin: '4px 0' }} />;
    case 'quote':
      return (
        <blockquote style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12, margin: 0 }}>
          <p style={{ fontStyle: 'italic', color: 'var(--foreground)', margin: 0 }}>{content.text}</p>
          {content.attribution && (
            <cite style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>— {content.attribution}</cite>
          )}
        </blockquote>
      );
    case 'statblock':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(content.rows || []).map((row: { label: string; value: string }, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--muted)', flex: 1, textAlign: 'right' }}>{row.label}</span>
              <span style={{ color: 'var(--foreground)', flex: 1.5 }}>{row.value}</span>
            </div>
          ))}
        </div>
      );
    case 'table':
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              {(content.headers || []).map((h: string, i: number) => (
                <th key={i} style={{ border: '1px solid var(--border)', padding: '6px 8px', textAlign: 'left', color: 'var(--foreground)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(content.rows || []).map((row: string[], ri: number) => (
              <tr key={ri}>
                {row.map((cell: string, ci: number) => (
                  <td key={ci} style={{ border: '1px solid var(--border)', padding: '6px 8px', color: 'var(--foreground)' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    default:
      return null;
  }
}

/**
 * ArticleTabViewer — Read-only tab viewer for WorldBibleEntry sidebar.
 * Renders tabs from entity.articleDoc (ArticleTab[] format).
 */
export function ArticleTabViewer({ articleDoc }: { articleDoc: string | undefined }) {
  const tabs = parseArticleTabs(articleDoc);
  const [activeTabId, setActiveTabId] = React.useState(tabs[0]?.id ?? '');

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

  // Sort widgets by y then x for read-order rendering
  const sortedWidgets = [...(activeTab?.widgets ?? [])].sort((a, b) =>
    a.y !== b.y ? a.y - b.y : a.x - b.x
  );

  return (
    <div>
      {/* Tab bar — only show if more than one tab */}
      {tabs.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 12,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab.id === activeTabId ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab.id === activeTabId ? 'var(--foreground)' : 'var(--muted)',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: tab.id === activeTabId ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* Widget content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedWidgets.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>No content yet.</p>
        ) : (
          sortedWidgets.map(widget => (
            <div key={widget.id}>
              <GridWidgetReadRenderer widget={widget} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
