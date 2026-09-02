"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Home, Library, NotebookPen, Globe, LayoutTemplate, Telescope, Settings } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { useWorkspaceStore, Project, Document, Entity, Scene, World } from '@/store/workspaceStore';
import styles from './ModeBar.module.css';
import SettingsModal from '../ui/SettingsModal';
import { NewProjectModal } from '../ui/NewProjectModal';
import { ProjectLibraryModal } from '../ui/ProjectLibraryModal';
import LoginModal from '../ui/LoginModal';
import { createClient } from '@/lib/supabase/client';

// ── User Profile Component ─────────────────────────────

function UserProfilePill({ onShowLogin }: { onShowLogin: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  if (!user) {
    return (
      <button className={styles.signInBtn} onClick={onShowLogin}>
        Log In
      </button>
    );
  }

  const email = user.email;
  const name = user.user_metadata?.full_name || email?.split('@')[0] || "Author";
  const avatar = user.user_metadata?.avatar_url;
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className={styles.profilePillWrapper}>
      <div 
        className={styles.profilePill} 
        onClick={() => setShowDropdown(!showDropdown)}
        onMouseEnter={() => setShowDropdown(true)}
      >
        {avatar ? (
          <img src={avatar} className={styles.profileAvatar} alt={name} />
        ) : (
          <div className={styles.profileAvatarPlaceholder}>{initials}</div>
        )}
        <div className={styles.profileInfo}>
          <span className={styles.profileName}>{name}</span>
          <span className={styles.profileStatus}>Signed in</span>
        </div>
      </div>

      {showDropdown && (
        <div className={styles.profileDropdown} onMouseLeave={() => setShowDropdown(false)}>
          <div className={styles.dropdownHeader}>
            <div className={styles.profileName}>{name}</div>
            <div className={styles.dropdownEmail}>{email}</div>
          </div>
          <button className={`${styles.dropdownItem} ${styles.dropdownItemSignOut}`} onClick={handleSignOut}>
            <span>🚪</span> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Search result types ───────────────────────────────

interface SearchResult {
  id: string;
  kind: 'scene' | 'entity' | 'document' | 'project';
  title: string;
  subtitle: string;   // project name, entity type, etc.
  excerpt: string;    // surrounding text of the match
  projectId: string;
  documentId?: string;
  sceneId?: string;
  entityId?: string;
}

/** Extract a short excerpt around a match in plain text */
function getExcerpt(text: string, query: string, radius = 60): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

/** Strip HTML tags to get plain text for searching */
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Pure search computation logic.
 * Reads raw store arrays and returns a ranked list of SearchResults.
 */
function computeResults(
  query: string,
  projects: Project[],
  documents: Document[],
  entities: Entity[],
  scenes: Scene[],
  worlds: World[]
): SearchResult[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const qLower = q.toLowerCase();
  const hits: SearchResult[] = [];
  const MAX = 12;

  // Projects
  projects.forEach(p => {
    if (hits.length >= MAX) return;
    if (p.name.toLowerCase().includes(qLower)) {
      hits.push({
        id: `project-${p.id}`,
        kind: 'project',
        title: p.name,
        subtitle: 'Project',
        excerpt: '',
        projectId: p.id,
      });
    }
  });

  // Documents (chapter titles)
  documents.forEach(doc => {
    if (hits.length >= MAX) return;
    if (doc.title.toLowerCase().includes(qLower)) {
      const project = projects.find(p => p.id === doc.projectId);
      hits.push({
        id: `document-${doc.id}`,
        kind: 'document',
        title: doc.title,
        subtitle: project?.name ?? 'Unknown project',
        excerpt: '',
        projectId: doc.projectId,
        documentId: doc.id,
      });
    }
  });

  // Entities (name + description)
  entities.forEach(e => {
    if (hits.length >= MAX) return;
    const nameMatch = e.name.toLowerCase().includes(qLower);
    const descMatch = e.description?.toLowerCase().includes(qLower);
    if (nameMatch || descMatch) {
      const world = worlds.find(w => w.id === e.worldId);
      hits.push({
        id: `entity-${e.id}`,
        kind: 'entity',
        title: e.name,
        subtitle: `${e.type} · ${world?.name ?? 'Standalone'}`,
        excerpt: descMatch && !nameMatch
          ? getExcerpt(e.description, q)
          : '',
        projectId: e.projectId,
        entityId: e.id,
      });
    }
  });

  // Scenes (content full-text — most expensive, do last)
  scenes.forEach(s => {
    if (hits.length >= MAX) return;
    const plain = stripHtml(s.content);
    if (plain.toLowerCase().includes(qLower)) {
      const doc = documents.find(d => d.id === s.documentId);
      const project = projects.find(p => p.id === s.projectId);
      hits.push({
        id: `scene-${s.id}`,
        kind: 'scene',
        title: s.title,
        subtitle: `${doc?.title ?? 'Chapter'} · ${project?.name ?? ''}`,
        excerpt: getExcerpt(plain, q),
        projectId: s.projectId,
        documentId: s.documentId,
        sceneId: s.id,
      });
    }
  });

  return hits;
}

/** Top-bar tabs the limelight indicator tracks. */
const MODE_TABS = [
  { mode: 'bookshelf', label: 'Bookshelf', Icon: Library },
  { mode: 'research', label: 'Research', Icon: Telescope },
  { mode: 'template', label: 'Draft Table', Icon: LayoutTemplate },
  { mode: 'desk', label: 'Writing Desk', Icon: NotebookPen },
  { mode: 'worldBible', label: 'World Bible', Icon: Globe },
] as const;

export default function ModeBar() {
  const workspaceMode = useWorkspaceStore(state => state.workspaceMode);
  const setWorkspaceMode = useWorkspaceStore(state => state.setWorkspaceMode);
  const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
  const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
  const setActiveScene = useWorkspaceStore(state => state.setActiveScene);
  const setFocusedArticleEntity = useWorkspaceStore(state => state.setFocusedArticleEntity);
  const theme = useWorkspaceStore(state => state.theme);
  const setTheme = useWorkspaceStore(state => state.setTheme);
  const setExportOpen = useWorkspaceStore(state => state.setExportOpen);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Limelight tab indicator ───────────────────────
  const leftGroupRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [limelight, setLimelight] = useState({ left: 0, width: 0, visible: false });
  const [limelightReady, setLimelightReady] = useState(false);

  useEffect(() => {
    const measure = () => {
      const group = leftGroupRef.current;
      const active = tabRefs.current[workspaceMode];
      if (group && active) {
        const g = group.getBoundingClientRect();
        const a = active.getBoundingClientRect();
        setLimelight({ left: a.left - g.left, width: a.width, visible: true });
      } else {
        // Modes without a tab (hierarchy, edit…) — dim the light in place.
        setLimelight(prev => ({ ...prev, visible: false }));
      }
    };
    measure();
    // Enable the slide transition only after the first placement.
    const id = requestAnimationFrame(() => setLimelightReady(true));
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', measure);
    };
  }, [workspaceMode]);

  // ── Theme / Settings helpers ───────────────────────

  const handleThemeToggle = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const renderThemeIcon = () => {
    if (theme === 'light') return '☀️';
    if (theme === 'dark') return '🌙';
    return '🖥️';
  };

  // ── Search logic ──────────────────────────────────

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);

    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Performance Fix: Read store imperatively ONLY when user types.
    // This prevents ModeBar from subscribing to and re-rendering on
    // every keystroke in the editor (which changes scenes/entities arrays).
    const { projects, documents, entities, scenes, worlds } = useWorkspaceStore.getState();
    const hits = computeResults(q, projects, documents, entities, scenes, worlds);

    setResults(hits);
    setSelectedIndex(0); // fresh results, fresh selection
    setIsOpen(true);
  };

  // ── Navigation on select ──────────────────────────

  const handleSelect = (result: SearchResult) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);

    switch (result.kind) {
      case 'project':
        setActiveProject(result.projectId);
        setWorkspaceMode('desk');
        break;
      case 'document':
        setActiveProject(result.projectId);
        setActiveDocument(result.documentId!);
        setWorkspaceMode('desk');
        break;
      case 'scene':
        setActiveProject(result.projectId);
        setActiveDocument(result.documentId!);
        setActiveScene(result.sceneId!);
        setWorkspaceMode('desk');
        break;
      case 'entity':
        if (result.projectId) setActiveProject(result.projectId);
        setFocusedArticleEntity(result.entityId!);
        setWorkspaceMode('worldBible');
        break;
    }
  };

  // ── Keyboard navigation ───────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i: number) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i: number) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // ── Kind icons & labels ───────────────────────────

  const KIND_ICON: Record<SearchResult['kind'], string> = {
    scene: '✍️',
    entity: '🧩',
    document: '📄',
    project: '📁',
  };

  const KIND_LABEL: Record<SearchResult['kind'], string> = {
    scene: 'Scene',
    entity: 'Entity',
    document: 'Chapter',
    project: 'Project',
  };

  // ── Render ────────────────────────────────────────

  return (
    <nav className={styles.modeBar}>
      <div className={styles.leftGroup} ref={leftGroupRef}>
        {/* Home — the logged-in home base (tracked by the limelight too) */}
        <button
          ref={el => { tabRefs.current['home'] = el; }}
          className={`${styles.homeBtn} ${workspaceMode === 'home' ? styles.homeBtnActive : ''}`}
          onClick={() => setWorkspaceMode('home')}
          title="Home"
          aria-label="Home"
        >
          <Home size={18} strokeWidth={1.75} />
        </button>

        {/* Limelight — glowing indicator that slides to the active tab and
            casts a light cone down over it. */}
        <span
          className={`${styles.limelight} ${limelightReady ? styles.limelightReady : ''} ${limelight.visible ? '' : styles.limelightHidden}`}
          style={{ left: limelight.left, width: limelight.width }}
          aria-hidden="true"
        >
          <span className={styles.limelightBar} />
          <span className={styles.limelightCone} />
        </span>

        {MODE_TABS.map(tab => (
          <button
            key={tab.mode}
            ref={el => { tabRefs.current[tab.mode] = el; }}
            className={`${styles.modeBtn} ${workspaceMode === tab.mode ? styles.modeBtnActive : ''}`}
            onClick={() => setWorkspaceMode(tab.mode)}
            title={tab.label}
            aria-label={tab.label}
          >
            <tab.Icon size={18} strokeWidth={1.75} />
          </button>
        ))}
      </div>

      {/* Center — global search */}
      <div className={styles.searchWrapper}>
        <div className={styles.searchInputWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            aria-label="Search everything"
            placeholder="Search everything..."
            value={query}
            onChange={handleSearchChange}
            onFocus={() => {
              if (query.trim().length >= 2) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              className={styles.searchClear}
              onMouseDown={e => { e.preventDefault(); setQuery(''); setResults([]); setIsOpen(false); }}
            >
              ×
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {isOpen && (
          <div ref={dropdownRef} className={styles.searchDropdown}>
            {results.length === 0 ? (
              <div className={styles.searchEmpty}>
                No results for &quot;{query}&quot;
              </div>
            ) : (
              results.map((result, i) => (
                <button
                  key={result.id}
                  className={`${styles.searchResult} ${i === selectedIndex ? styles.searchResultActive : ''}`}
                  onMouseDown={e => { e.preventDefault(); handleSelect(result); }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span className={styles.searchResultIcon}>
                    {KIND_ICON[result.kind]}
                  </span>
                  <div className={styles.searchResultBody}>
                    <div className={styles.searchResultTop}>
                      <span className={styles.searchResultTitle}>{result.title}</span>
                      <span className={styles.searchResultKind}>
                        {KIND_LABEL[result.kind]}
                      </span>
                    </div>
                    <div className={styles.searchResultSub}>{result.subtitle}</div>
                    {result.excerpt && (
                      <div className={styles.searchResultExcerpt}>
                        {result.excerpt}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className={styles.topBarActions}>
        <UserProfilePill onShowLogin={() => setShowLoginModal(true)} />

        <button
          className={styles.iconBtn}
          onClick={() => setExportOpen(true)}
          title="Export (Ctrl+E)"
        >
          ↓
        </button>

        <button
          className={styles.iconBtn}
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          <Settings size={16} />
        </button>

        <button
          className={styles.iconBtn}
          onClick={handleThemeToggle}
          title={`Theme: ${theme}`}
        >
          {renderThemeIcon()}
        </button>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      <NewProjectModal isOpen={showNew} onClose={() => setShowNew(false)} />
      <ProjectLibraryModal isOpen={showLoad} onClose={() => setShowLoad(false)} />
    </nav>
  );
}
