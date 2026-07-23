"use client";

import React, { useEffect, useState } from 'react';
import { Library, NotebookPen, Globe, LayoutTemplate, ArrowRight, Plus } from 'lucide-react';
import { useWorkspaceStore, WorkspaceMode } from '@/store/workspaceStore';
import { createClient } from '@/lib/supabase/client';
import styles from './HomePage.module.css';

/**
 * HomePage — the logged-in home base the top-bar Home button lands on.
 * Quick first pass: greeting, quick-launch into the four workspaces, and a
 * recent-projects strip. Meant to be fleshed out later.
 */

interface QuickLink {
  mode: WorkspaceMode;
  label: string;
  desc: string;
  Icon: typeof Library;
}

const QUICK_LINKS: QuickLink[] = [
  { mode: 'bookshelf', label: 'Bookshelf', desc: 'Your shelves & projects', Icon: Library },
  { mode: 'desk', label: 'Writing Desk', desc: 'Write your manuscript', Icon: NotebookPen },
  { mode: 'worldBible', label: 'World Bible', desc: 'Characters, places & lore', Icon: Globe },
  { mode: 'template', label: 'Draft Table', desc: 'Design & templates', Icon: LayoutTemplate },
];

export default function HomePage() {
  const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
  const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
  const projects = useWorkspaceStore(s => s.projects);

  const [name, setName] = useState('Author');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setName(u.user_metadata?.full_name || u.email?.split('@')[0] || 'Author');
    });
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const recent = [...projects]
    .sort((a, b) => {
      const at = new Date(a.updatedAt ?? a.createdAt).getTime();
      const bt = new Date(b.updatedAt ?? b.createdAt).getTime();
      return bt - at;
    })
    .slice(0, 6);

  const openProject = (id: string) => {
    setActiveProject(id);
    setWorkspaceMode('desk');
  };

  return (
    <div className={styles.home}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <p className={styles.greeting}>{greeting},</p>
          <h1 className={styles.name}>{name}</h1>
          <p className={styles.tagline}>Where would you like to begin?</p>
        </header>

        <section className={styles.quickGrid}>
          {QUICK_LINKS.map(link => (
            <button
              key={link.mode}
              className={styles.quickCard}
              onClick={() => setWorkspaceMode(link.mode)}
            >
              <span className={styles.quickIcon}>
                <link.Icon size={22} strokeWidth={1.6} />
              </span>
              <span className={styles.quickText}>
                <span className={styles.quickLabel}>{link.label}</span>
                <span className={styles.quickDesc}>{link.desc}</span>
              </span>
              <ArrowRight size={16} className={styles.quickArrow} />
            </button>
          ))}
        </section>

        <section className={styles.recentSection}>
          <div className={styles.recentHead}>
            <h2 className={styles.recentTitle}>Recent projects</h2>
            <button className={styles.recentAll} onClick={() => setWorkspaceMode('bookshelf')}>
              View all
            </button>
          </div>

          {recent.length > 0 ? (
            <div className={styles.recentGrid}>
              {recent.map(p => (
                <button
                  key={p.id}
                  className={styles.projectCard}
                  onClick={() => openProject(p.id)}
                >
                  <span
                    className={styles.projectCover}
                    style={p.coverImageUrl
                      ? { backgroundImage: `url(${p.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: p.coverColor || '#3a3a44' }}
                  />
                  <span className={styles.projectName}>{p.name}</span>
                  <span className={styles.projectMode}>{p.writingMode}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyRecent}>
              <p className={styles.emptyText}>No projects yet.</p>
              <button className={styles.newBtn} onClick={() => setWorkspaceMode('bookshelf')}>
                <Plus size={16} /> Start on the Bookshelf
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
