"use client";

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from '../WritingDesk.module.css';

export function BookCoverEditor({ projectId }: { projectId: string }) {
  const project = useWorkspaceStore(s => s.projects.find(p => p.id === projectId));
  const worlds = useWorkspaceStore(s => s.worlds);
  const entities = useWorkspaceStore(s => s.entities);
  const updateProject = useWorkspaceStore(s => s.updateProject);

  const [name, setName] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [worldId, setWorldId] = useState('');
  const [attributedEntityId, setAttributedEntityId] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setAuthorName(project.authorName || '');
      setDescription(project.description || '');
      setWorldId(project.worldId || '');
      setAttributedEntityId(project.attributedEntityId || '');
      setCoverImageUrl(project.coverImageUrl || '');
    }
  }, [project]);

  if (!project) return null;

  const handleSave = () => {
    updateProject(projectId, {
      name,
      authorName,
      description,
      worldId: worldId || undefined,
      attributedEntityId: attributedEntityId || undefined,
      coverImageUrl
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setCoverImageUrl(base64);
      updateProject(projectId, { coverImageUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const worldCharacters = entities.filter(e => 
// @ts-ignore
    e.worldId === worldId && 
    e.type === 'character'
  );

  return (
    <div className={styles.coverEditorContainer} onMouseDown={e => e.stopPropagation()}>
      <div className={styles.coverEditorHeader}>
        <h1 className={styles.coverEditorHeaderTitle}>Book Information</h1>
        <p className={styles.coverEditorHeaderSub}>Manage manuscript metadata and cover design</p>
      </div>

      <div className={styles.coverEditorGrid}>
        <div className={styles.coverEditorSidebar}>
          <div 
            className={styles.coverEditorPreview} 
            style={{ 
              background: project.coverColor, 
              backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!coverImageUrl && (
              <span className={styles.coverEditorPreviewInitials}>
                {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            )}
            <input 
              type="file" 
              id="cover-editor-upload" 
              hidden 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            <label htmlFor="cover-editor-upload" className={styles.coverEditorUploadOverlay}>
              <span>📷 Change Cover</span>
            </label>
          </div>
          {coverImageUrl && (
            <button 
              className={styles.coverEditorRemoveBtn}
              onClick={() => { setCoverImageUrl(''); updateProject(projectId, { coverImageUrl: '' }); }}
            >
              Remove Image
            </button>
          )}
        </div>

        <div className={styles.coverEditorForm}>
          <div className={styles.coverEditorField}>
            <label>Project Title</label>
            <input 
              value={name}
              onChange={e => { setName(e.target.value); updateProject(projectId, { name: e.target.value }); }}
              placeholder="The Great Novel..."
            />
          </div>

          <div className={styles.coverEditorField}>
            <label>Author Name</label>
            <input 
              value={authorName}
              onChange={e => { setAuthorName(e.target.value); updateProject(projectId, { authorName: e.target.value }); }}
              placeholder="Your pen name..."
            />
          </div>

          <div className={styles.coverEditorField}>
            <label>Associated World Bible</label>
            <select 
              value={worldId}
              onChange={e => {
                const wid = e.target.value;
                setWorldId(wid);
                setAttributedEntityId('');
                updateProject(projectId, { worldId: wid || undefined, attributedEntityId: undefined });
              }}
            >
              <option value="">No Associated World</option>
              {worlds.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {worldId && (
            <div className={styles.coverEditorField}>
              <label>Fictional Character Attribution</label>
              <select 
                value={attributedEntityId}
                onChange={e => {
                  const aid = e.target.value;
                  setAttributedEntityId(aid);
                  updateProject(projectId, { attributedEntityId: aid || undefined });
                }}
              >
                <option value="">None</option>
                {worldCharacters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className={styles.fieldHint}>Linking to a character will show this book on their article page.</p>
            </div>
          )}

          <div className={styles.coverEditorField}>
            <label>Project Description / Blurb</label>
            <textarea 
              value={description}
              onChange={e => { setDescription(e.target.value); updateProject(projectId, { description: e.target.value }); }}
              placeholder="A brief summary of your masterpiece..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
