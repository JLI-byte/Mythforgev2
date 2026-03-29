"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './BetaFeedbackPanel.module.css';

interface BetaFeedbackPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTabClick: () => void;
  tabWidth: number;
  onTabWidthChange: (width: number) => void;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
}

type FeedbackType = 'bug' | 'feature' | 'general';

interface FeedbackEntry {
  id: string;
  type: FeedbackType;
  title: string;
  body: string;
  submittedAt: string;
}

const STORAGE_KEY = 'mythforge-beta-feedback';

function loadFeedback(): FeedbackEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveFeedback(entries: FeedbackEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

const BugIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="6"/><path d="M12 3v4"/><path d="M6.3 7.3l2 2"/><path d="M17.7 7.3l-2 2"/>
    <path d="M3 13h3"/><path d="M18 13h3"/><path d="M9 20l1-4"/><path d="M15 20l-1-4"/>
  </svg>
);

export function BetaFeedbackPanel({
  isOpen, onClose, onTabClick, tabWidth, onTabWidthChange, panelWidth, onPanelWidthChange
}: BetaFeedbackPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<FeedbackEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) setHistory(loadFeedback());
  }, [isOpen]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const entry: FeedbackEntry = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      type: feedbackType,
      title: title.trim(),
      body: body.trim(),
      submittedAt: new Date().toISOString(),
    };
    const updated = [entry, ...history];
    saveFeedback(updated);
    setHistory(updated);
    setTitle('');
    setBody('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const handleExport = () => {
    const text = history.map(e =>
      `[${e.type.toUpperCase()}] ${e.title}\n${new Date(e.submittedAt).toLocaleString()}\n${e.body}`
    ).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mythforge-beta-feedback-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TYPE_LABELS: Record<FeedbackType, string> = {
    bug: '🐛 Bug Report',
    feature: '💡 Feature Request',
    general: '💬 General Feedback',
  };

  const TYPE_PLACEHOLDERS: Record<FeedbackType, string> = {
    bug: 'e.g. Clicking the X button in the tab bar crashes the app',
    feature: 'e.g. Add ability to export World Bible as PDF',
    general: 'e.g. The ripple effect on the landing page is really satisfying',
  };

  // Tab offset — position below the other tabs
  // The Beta tab sits at the bottom of the tab rail with a visual gap
  const TAB_TOP_OFFSET = 'calc(100vh - 200px)';

  return (
    <>
      {mounted && createPortal(
        <button
          className={`${styles.sideTab} ${isOpen ? styles.sideTabActive : ''}`}
          style={{
            width: tabWidth,
            right: isOpen ? panelWidth : 0,
            top: TAB_TOP_OFFSET,
            transition: 'right 280ms ease-in-out',
          }}
          onClick={onTabClick}
          title="Beta Feedback"
          aria-label="Toggle Beta Feedback"
        >
          <div
            className={styles.dragHandle}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const startX = e.clientX;
              const startW = tabWidth;
              const onMove = (mv: MouseEvent) => {
                onTabWidthChange(Math.min(120, Math.max(44, startW + (startX - mv.clientX))));
              };
              const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          />
          <BugIcon />
          <span className={styles.sideTabLabel}>Beta</span>
        </button>,
        document.body
      )}

      <div
        className={`${styles.panel} ${isOpen ? styles.open : ''}`}
        style={{ width: panelWidth }}
      >
        <div className={styles.panelInner}>
          {/* Resize handle */}
          <div
            className={styles.panelResizeHandle}
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = panelWidth;
              const onMove = (mv: MouseEvent) => {
                onPanelWidthChange(Math.min(700, Math.max(300, startW + (startX - mv.clientX))));
              };
              const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          />

          {/* Header */}
          <div className={styles.header}>
            <div>
              <div className={styles.headerTop}>
                <span className={styles.betaBadge}>BETA</span>
                <h3 className={styles.title}>Feedback</h3>
              </div>
              <p className={styles.subtitle}>Your feedback shapes MythForge.</p>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div className={styles.content}>
            {/* Type selector */}
            <div className={styles.typeCol}>
              {(['bug', 'feature', 'general'] as FeedbackType[]).map(t => (
                <button
                  key={t}
                  className={`${styles.typeBtn} ${feedbackType === t ? styles.typeBtnActive : ''}`}
                  onClick={() => setFeedbackType(t)}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Title */}
            <div className={styles.field}>
              <label className={styles.label}>TITLE</label>
              <input
                className={styles.input}
                type="text"
                placeholder={TYPE_PLACEHOLDERS[feedbackType]}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSubmit(); }}
                maxLength={120}
              />
            </div>

            {/* Body */}
            <div className={styles.field}>
              <label className={styles.label}>
                DETAILS <span className={styles.optional}>— optional</span>
              </label>
              <textarea
                className={styles.textarea}
                placeholder="Steps to reproduce, additional context..."
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={4}
              />
            </div>

            {/* Submit */}
            <button
              className={`${styles.submitBtn} ${submitted ? styles.submitBtnSuccess : ''}`}
              onClick={handleSubmit}
              disabled={!title.trim() || submitted}
            >
              {submitted ? '✓ Saved — thank you!' : 'Submit Feedback'}
            </button>

            <p className={styles.storageNote}>
              Saved locally. Use Export to share with the team.
            </p>

            {/* History divider */}
            <div className={styles.dividerRow}>
              <div className={styles.dividerLine} />
              <button className={styles.historyToggle} onClick={() => setShowHistory(v => !v)}>
                {showHistory ? '▾' : '▸'} {history.length} submitted
              </button>
              {history.length > 0 && (
                <button className={styles.exportBtn} onClick={handleExport}>Export</button>
              )}
            </div>

            {showHistory && (
              <div className={styles.historyList}>
                {history.length === 0 ? (
                  <p className={styles.emptyHistory}>Nothing yet.</p>
                ) : history.map(entry => (
                  <div key={entry.id} className={styles.historyEntry}>
                    <div className={styles.entryMeta}>
                      <span className={`${styles.entryType} ${styles[`entryType_${entry.type}`]}`}>
                        {entry.type}
                      </span>
                      <span className={styles.entryDate}>
                        {new Date(entry.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={styles.entryTitle}>{entry.title}</p>
                    {entry.body && <p className={styles.entryBody}>{entry.body}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
