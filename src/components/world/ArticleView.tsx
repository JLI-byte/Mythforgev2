"use client";

import React, { useMemo, useRef, useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { useWorkspaceStore, Entity, EntityType, GalleryImage, ArticleTab } from '@/store/workspaceStore';
import { SUBCATEGORY_LABELS, SUBCATEGORY_ICONS } from '@/lib/worldBibleNav';
import { worldKeyForEntity, worldKeyForProject } from '@/lib/worldKey';
import { findEntityMentions } from './ArticleReadView';
import { ArticleTabViewer } from './ArticleViewerShared';
import { fileToDataUrl } from './profile/editors/imageUpload';
import styles from './ArticleView.module.css';

/**
 * ArticleView — the gallery-hero article (Sprint 74).
 *
 * Read mode: the article's images form the header as side-by-side panels
 * that expand on hover (gallery-animation style) and open a lightbox on
 * click. Tabs dock over the hero's bottom edge: the article's own prose
 * tabs, plus Document (legacy articleDoc), Connections, and Mentions.
 * A charcoal quick-facts rail (customFields + tags) sits beside content.
 *
 * Edit mode: in-place editing buffered in a draft — title, tab
 * add/rename/remove, prose, facts, tags, gallery images (upload/remove/
 * caption), and related links. Save commits via updateEntity; Discard
 * throws the draft away.
 */

interface ArticleViewProps {
  entityId: string;
  onBack: () => void;
  /** Navigate to another article (Connections tab links) */
  onOpenEntity: (id: string) => void;
}

const TYPE_COLORS: Record<EntityType, string> = {
  character: '#4A6FA5',
  faction: '#6B4C9A',
  location: '#2E8B57',
  artifact: '#C0392B',
  lore: '#D46A1A',
  magic: '#9B59B6',
  religion: '#F1C40F',
  species: '#27AE60',
};

/** Placeholder hues cycled for uploaded-less gallery slots */
const PLACEHOLDER_COLORS = ['#3d2f5e', '#2f4a5e', '#5e3d2f', '#2f5e57', '#54402f', '#3a3a52'];

interface Draft {
  name: string;
  tags: string[];
  facts: { label: string; value: string }[];
  images: GalleryImage[];
  tabs: ArticleTab[];
  relatedIds: string[];
}

function makeDraft(e: Entity): Draft {
  return {
    name: e.name,
    tags: (e.tags ?? []).slice(),
    facts: (e.customFields ?? []).map(f => ({ ...f })),
    images: (e.galleryImages ?? []).map(i => ({ ...i })),
    tabs: e.articleTabs?.length
      ? e.articleTabs.map(t => ({ ...t }))
      : [{ id: crypto.randomUUID(), label: 'Overview', content: e.description || '' }],
    relatedIds: (e.relatedIds ?? []).slice(),
  };
}

/** Render plain text as paragraphs (blank line = break) */
function renderParas(text: string) {
  const parts = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return <p className={styles.emptyHint}>Nothing written here yet.</p>;
  return parts.map((p, i) => <p key={i} className={styles.para}>{p}</p>);
}

export default function ArticleView({ entityId, onBack, onOpenEntity }: ArticleViewProps) {
  const entities = useWorkspaceStore(s => s.entities);
  const updateEntity = useWorkspaceStore(s => s.updateEntity);
  const toggleEntityFavorite = useWorkspaceStore(s => s.toggleEntityFavorite);
  const scenes = useWorkspaceStore(s => s.scenes);
  const documents = useWorkspaceStore(s => s.documents);
  const projects = useWorkspaceStore(s => s.projects);
  const setActiveScene = useWorkspaceStore(s => s.setActiveScene);
  const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
  const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
  const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);

  const entity = entities.find(e => e.id === entityId);

  // Draft lives in a ref so text edits never reset carets; `version` bumps
  // re-render only on structural changes (add/remove tab/fact/tag/image).
  const draftRef = useRef<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [, setVersion] = useState(0);
  const bump = () => setVersion(v => v + 1);

  const [activeKey, setActiveKey] = useState<string>('');
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mentions = useMemo(() => {
    if (!entity || activeKey !== 'mentions') return [];
    const worldKey = worldKeyForEntity(entity);
    const ids = new Set(projects.filter(p => worldKeyForProject(p) === worldKey).map(p => p.id));
    return findEntityMentions(entity.id, entity.name, ids, scenes, documents);
  }, [entity, activeKey, projects, scenes, documents]);

  if (!entity) {
    return (
      <div className={styles.root}>
        <div className={styles.wrap}>
          <button className={styles.backBtn} onClick={onBack}>← World Bible</button>
          <p className={styles.emptyHint}>Entity not found.</p>
        </div>
      </div>
    );
  }

  const attributedWorks = projects.filter(p => p.attributedEntityId === entityId);
  const typeIcon = SUBCATEGORY_ICONS[entity.type];
  const typeLabel = SUBCATEGORY_LABELS[entity.type];

  // ── Model: read from entity, or the draft while editing ──
  const d: Draft = editing && draftRef.current ? draftRef.current : makeDraft(entity);

  // Header images — fall back to a single cover/type panel when none exist
  const heroImages: GalleryImage[] = d.images.length
    ? d.images
    : [{ url: entity.imageUrl, color: TYPE_COLORS[entity.type], caption: entity.name }];

  const proseTabs = d.tabs;
  const hasDoc = !!entity.articleDoc;
  const currentKey = activeKey || proseTabs[0]?.id || 'conn';
  const currentProse = proseTabs.find(t => t.id === currentKey);

  // ── Edit lifecycle ──
  const startEdit = () => { draftRef.current = makeDraft(entity); setEditing(true); bump(); };
  const discard = () => { draftRef.current = null; setEditing(false); bump(); };
  const save = () => {
    const dr = draftRef.current;
    if (!dr) return;
    updateEntity(entity.id, {
      name: dr.name.trim() || entity.name,
      tags: dr.tags,
      customFields: dr.facts,
      galleryImages: dr.images,
      articleTabs: dr.tabs,
      relatedIds: dr.relatedIds,
    });
    draftRef.current = null;
    setEditing(false);
    bump();
  };

  const addImage = async (file: File | null) => {
    const dr = draftRef.current;
    if (!dr) return;
    if (file) {
      const url = await fileToDataUrl(file);
      dr.images.push({ url, caption: 'New image' });
    } else {
      dr.images.push({ color: PLACEHOLDER_COLORS[dr.images.length % PLACEHOLDER_COLORS.length], caption: 'New image' });
    }
    bump();
  };

  // Related picker options: same-world entities, minus self and already-linked
  const worldKey = worldKeyForEntity(entity);
  const relatable = entities.filter(e =>
    e.id !== entity.id && worldKeyForEntity(e) === worldKey && !d.relatedIds.includes(e.id)
  );
  const relatedEntities = d.relatedIds
    .map(id => entities.find(e => e.id === id))
    .filter((e): e is Entity => !!e);

  // ── Panels ──
  const galleryPanel = (img: GalleryImage, i: number) => (
    <div
      key={i}
      className={styles.gPanel}
      style={img.url
        ? { backgroundImage: `url(${img.url})` }
        : { background: `linear-gradient(160deg, ${img.color ?? '#3a3a44'} 0%, #17171a 100%)` }}
      onClick={() => { if (!editing) setLightbox(img); }}
    >
      {!img.url && <span>{typeIcon}</span>}
      {editing ? (
        <input
          className={styles.gCapEdit}
          defaultValue={img.caption}
          onChange={e => { img.caption = e.target.value; }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className={styles.gCap}>{img.caption}</span>
      )}
      <span className={styles.expandHint}>⤢</span>
      {editing && d.images.length > 0 && (
        <button
          className={`${styles.xBtn} ${styles.rmImg}`}
          onClick={e => { e.stopPropagation(); d.images.splice(i, 1); bump(); }}
          aria-label="Remove image"
        ><X size={12} /></button>
      )}
    </div>
  );

  const tabButton = (key: string, label: React.ReactNode, removable = false, idx = 0) => (
    <button
      key={key}
      className={`${styles.tab} ${currentKey === key ? styles.tabOn : ''}`}
      onClick={() => setActiveKey(key)}
    >
      {label}
      {editing && removable && proseTabs.length > 1 && (
        <span
          className={styles.xBtn}
          onClick={e => {
            e.stopPropagation();
            d.tabs.splice(idx, 1);
            if (currentKey === key) setActiveKey(d.tabs[0]?.id ?? 'conn');
            bump();
          }}
        ><X size={12} /></span>
      )}
    </button>
  );

  const factsBlock = editing ? (
    <>
      {d.facts.map((f, i) => (
        <div key={i} className={styles.factRow}>
          <input className={`${styles.eInput} ${styles.eInputK}`} defaultValue={f.label}
            onChange={e => { f.label = e.target.value; }} />
          <input className={`${styles.eInput} ${styles.eInputV}`} defaultValue={f.value}
            onChange={e => { f.value = e.target.value; }} />
          <button className={styles.xBtn} onClick={() => { d.facts.splice(i, 1); bump(); }} aria-label="Remove fact"><X size={12} /></button>
        </div>
      ))}
      <div style={{ marginTop: 10 }}>
        <span className={styles.addBtn} onClick={() => { d.facts.push({ label: 'Field', value: 'Value' }); bump(); }}>
          ＋ Add fact
        </span>
      </div>
    </>
  ) : (
    d.facts.length
      ? d.facts.map((f, i) => (
          <div key={i} className={styles.factRow}>
            <span className={styles.factK}>{f.label}</span>
            <span className={styles.factV}>{f.value}</span>
          </div>
        ))
      : <p className={styles.emptyHint}>No facts yet.</p>
  );

  const tagsBlock = (
    <div className={styles.tagRow}>
      {d.tags.map((t, i) => (
        <span key={i} className={styles.tag}>
          {t}
          {editing && <button className={styles.xBtn} onClick={() => { d.tags.splice(i, 1); bump(); }} aria-label="Remove tag"><X size={12} /></button>}
        </span>
      ))}
      {editing && (
        <input
          className={styles.eInput}
          placeholder="＋ tag"
          style={{ width: 74 }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const v = (e.target as HTMLInputElement).value.trim();
              if (v) { d.tags.push(v); (e.target as HTMLInputElement).value = ''; bump(); }
            }
          }}
        />
      )}
      {!editing && !d.tags.length && <span className={styles.emptyHint}>No tags.</span>}
    </div>
  );

  const connectionsPanel = (
    <>
      <h3 className={styles.secTitle}>Related articles</h3>
      <div className={styles.relGrid}>
        {relatedEntities.map((r, i) => (
          <button key={r.id} className={styles.relCard} onClick={() => { if (!editing) onOpenEntity(r.id); }}>
            <span
              className={styles.relDot}
              style={r.imageUrl ? { backgroundImage: `url(${r.imageUrl})` } : undefined}
            >{!r.imageUrl && SUBCATEGORY_ICONS[r.type]}</span>
            <span>
              <div className={styles.relName}>{r.name}</div>
              <div className={styles.relType}>{r.type}</div>
            </span>
            {editing && (
              <span className={styles.xBtn} style={{ marginLeft: 'auto' }}
                onClick={e => { e.stopPropagation(); d.relatedIds.splice(i, 1); bump(); }}><X size={12} /></span>
            )}
          </button>
        ))}
        {!relatedEntities.length && !editing && (
          <p className={styles.emptyHint}>No linked articles yet.</p>
        )}
      </div>
      {editing && (
        <div className={styles.relPicker}>
          <select className={styles.relSelect} id="lc-rel-picker" defaultValue="">
            <option value="" disabled>Link an article…</option>
            {relatable.map(e => (
              <option key={e.id} value={e.id}>{SUBCATEGORY_ICONS[e.type]} {e.name}</option>
            ))}
          </select>
          <span className={styles.addBtn} onClick={() => {
            const sel = document.getElementById('lc-rel-picker') as HTMLSelectElement | null;
            if (sel?.value) { d.relatedIds.push(sel.value); bump(); }
          }}>＋ Link</span>
        </div>
      )}
      {attributedWorks.length > 0 && (
        <>
          <h3 className={styles.secTitle} style={{ marginTop: 22 }}>Works</h3>
          <div className={styles.relGrid}>
            {attributedWorks.map(w => (
              <button key={w.id} className={styles.relCard}
                onClick={() => { setActiveProject(w.id); setWorkspaceMode('desk'); }}>
                <span className={styles.relDot} style={{ background: w.coverColor || '#1f1f1e' }}>📖</span>
                <span>
                  <div className={styles.relName}>{w.name}</div>
                  <div className={styles.relType}>{w.writingMode}</div>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );

  const mentionsPanel = mentions.length === 0 ? (
    <p className={styles.emptyHint}>No mentions of <strong>{entity.name}</strong> found in any scene yet.</p>
  ) : (
    <>
      <h3 className={styles.secTitle}>{mentions.length} mention{mentions.length !== 1 ? 's' : ''}</h3>
      {mentions.map((m, i) => (
        <button key={i} className={styles.mentionCard} onClick={() => {
          setActiveDocument(m.documentId);
          setActiveScene(m.sceneId);
          setWorkspaceMode('desk');
        }}>
          <div className={styles.mentionHead}>{m.documentTitle} › {m.sceneTitle}</div>
          <p className={styles.mentionExcerpt}>
            {m.excerpt.slice(0, m.matchIndex)}
            <mark>{m.excerpt.slice(m.matchIndex, m.matchIndex + m.matchLength)}</mark>
            {m.excerpt.slice(m.matchIndex + m.matchLength)}
          </p>
        </button>
      ))}
    </>
  );

  const panelContent =
    currentKey === 'conn' ? connectionsPanel
    : currentKey === 'mentions' ? mentionsPanel
    : currentKey === 'doc' ? <ArticleTabViewer articleDoc={entity.articleDoc} />
    : currentProse ? (
        editing ? (
          <div
            key={currentProse.id}
            className={`${styles.editable} ${styles.contentEdit}`}
            contentEditable
            suppressContentEditableWarning
            onInput={e => { currentProse.content = (e.target as HTMLElement).innerText; }}
          >{currentProse.content}</div>
        ) : renderParas(currentProse.content)
      )
    : null;

  return (
    <div className={styles.root}>
      <div className={styles.wrap}>
        {/* ── Top bar ── */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={onBack}>← World Bible</button>
          <div className={styles.topActions}>
            <button
              className={`${styles.actionBtn} ${entity.isFavorite ? styles.actionBtnActive : ''}`}
              onClick={() => toggleEntityFavorite(entity.id)}
              title={entity.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >{entity.isFavorite ? '⭐' : '☆'}</button>
            {!editing && (
              <button className={styles.actionBtn} onClick={startEdit}><Pencil size={14} /> Edit article</button>
            )}
          </div>
        </div>

        {/* ── Gallery hero ── */}
        <div className={styles.hero}>
          <div className={styles.heroGal}>
            {heroImages.map(galleryPanel)}
            {editing && (
              <button className={styles.ghostPanel} onClick={() => fileRef.current?.click()}>
                ＋<small>Add image</small>
              </button>
            )}
          </div>
          <div className={styles.heroWash} />
          <div className={styles.heroText}>
            <span className={styles.typePill}>{typeIcon} {typeLabel}</span><br />
            {editing ? (
              <h1
                className={`${styles.title} ${styles.editable}`}
                contentEditable
                suppressContentEditableWarning
                onInput={e => { d.name = (e.target as HTMLElement).innerText; }}
              >{d.name}</h1>
            ) : (
              <h1 className={styles.title}>{entity.name}</h1>
            )}
          </div>
          <div className={styles.heroTabs}>
            {proseTabs.map((t, i) => tabButton(
              t.id,
              editing ? (
                <span
                  className={`${styles.tabName} ${styles.editable}`}
                  contentEditable
                  suppressContentEditableWarning
                  onClick={e => e.stopPropagation()}
                  onInput={e => { t.label = (e.target as HTMLElement).innerText; }}
                >{t.label}</span>
              ) : t.label,
              true, i
            ))}
            {editing && (
              <button className={styles.tabAdd} onClick={() => {
                const nt = { id: crypto.randomUUID(), label: 'New Tab', content: '' };
                d.tabs.push(nt);
                setActiveKey(nt.id);
                bump();
              }}>＋ Tab</button>
            )}
            {hasDoc && tabButton('doc', '📄 Document')}
            {tabButton('conn', 'Connections')}
            {!editing && tabButton('mentions', 'Mentions')}
          </div>
        </div>

        {/* ── Body ── */}
        <div className={styles.bodyGrid}>
          <div className={`${styles.panel} ${styles.glass}`}>{panelContent}</div>
          <aside className={styles.rail}>
            <div className={styles.railSec}>Quick facts</div>
            {factsBlock}
            <div className={styles.railSec}>Tags</div>
            {tagsBlock}
          </aside>
        </div>

        <footer className={styles.metaFooter}>
          <span>Created {new Date(entity.createdAt).toLocaleDateString()}</span>
          {entity.updatedAt && <span>· Updated {new Date(entity.updatedAt).toLocaleDateString()}</span>}
        </footer>
      </div>

      {/* hidden picker for gallery uploads */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { addImage(e.target.files?.[0] ?? null); e.target.value = ''; }}
      />

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <div
            className={styles.lbCard}
            style={lightbox.url
              ? { backgroundImage: `url(${lightbox.url})` }
              : { background: `linear-gradient(160deg, ${lightbox.color ?? '#3a3a44'} 0%, #17171a 100%)` }}
            onClick={e => e.stopPropagation()}
          >
            {!lightbox.url && <span>{typeIcon}</span>}
            <div className={styles.lbCap}>
              {lightbox.caption === entity.name ? entity.name : `${lightbox.caption} — ${entity.name}`}
            </div>
            <button className={styles.lbClose} onClick={() => setLightbox(null)} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Edit bar ── */}
      {editing && (
        <div className={styles.editBar}>
          <span className={styles.editMsg}>✏️ EDITING</span>
          <button className={styles.saveBtn} onClick={save}>Save changes</button>
          <button className={styles.discardBtn} onClick={discard}>Discard</button>
        </div>
      )}
    </div>
  );
}
