import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { GridWidget, ArticleTab, WidgetType, parseArticleTabs } from './ArticleGridEditor';
import ArticleGridEditor from './ArticleGridEditor';
import styles from './TemplateDesigner.module.css';

export default function TemplateDesigner() {
  const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
  const entities = useWorkspaceStore(state => state.entities);
  const addEntity = useWorkspaceStore(state => state.addEntity);
  const deleteEntity = useWorkspaceStore(state => state.deleteEntity);
  const updateEntityDoc = useWorkspaceStore(state => state.updateEntityDoc);
  const saveArticleTemplate = useWorkspaceStore(state => state.saveArticleTemplate);
  const deleteArticleTemplate = useWorkspaceStore(state => state.deleteArticleTemplate);
  const applyArticleTemplate = useWorkspaceStore(state => state.applyArticleTemplate);
  const articleTemplates = useWorkspaceStore(state => state.articleTemplates);

  const phantomIdRef = useRef<string>('');
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [nameError, setNameError] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [canvasCleared, setCanvasCleared] = useState(false);
  const [applyTarget, setApplyTarget] = useState<string>('');
  const [applyForTemplate, setApplyForTemplate] = useState<string>('');
  const [applyConfirm, setApplyConfirm] = useState(false);

  // Create phantom entity on mount
  useEffect(() => {
    const id = crypto.randomUUID();
    phantomIdRef.current = id;
    const phantomEntity = {
      id,
      projectId: activeProjectId ?? '',
      name: '__template_designer_canvas__',
      type: 'lore' as const,
      description: '',
      createdAt: new Date(),
      articleDoc: '',
    } as any; // cast to Entity shape
    addEntity(phantomEntity);
    return () => {
      deleteEntity(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phantomEntity = entities.find(e => e.id === phantomIdRef.current);

  const getCurrentWidgets = (): GridWidget[] => {
    if (!phantomEntity) return [];
    const tabs = parseArticleTabs(phantomEntity.articleDoc);
    const activeTab = tabs[0];
    return activeTab?.widgets ?? [];
  };

  const handleNewTemplate = () => {
    // clear canvas by resetting articleDoc to empty array JSON
    updateEntityDoc(phantomIdRef.current, JSON.stringify([]));
    setTemplateName('');
    setTemplateDesc('');
    setNameError(false);
    setCanvasCleared(true);
    setTimeout(() => setCanvasCleared(false), 2000);
  };

  const handleSave = () => {
    if (!templateName.trim()) {
      setNameError(true);
      return;
    }
    const widgets = getCurrentWidgets();
    // Cast GridWidget[] to ArticleBlock[] (store will strip content)
    saveArticleTemplate(templateName.trim(), templateDesc || undefined, widgets as any);
    setTemplateName('');
    setTemplateDesc('');
    setNameError(false);
    setSaveConfirm(true);
    setTimeout(() => setSaveConfirm(false), 2000);
  };

  const handleApply = (templateId: string) => {
    if (!applyTarget) return;
    applyArticleTemplate(applyTarget, templateId);
    setApplyConfirm(true);
    setTimeout(() => setApplyConfirm(false), 2000);
    // reset selector
    setApplyTarget('');
    setApplyForTemplate('');
  };

  return (
    <div className={styles.designerRoot}>
      {/* LEFT PANEL */}
      <aside className={styles.libraryPanel}>
        <div className={styles.libraryHeader}>
          <span>🎨 Templates</span>
          <button className={styles.newTemplateBtn} onClick={handleNewTemplate}>New Template</button>
        </div>
        <form className={styles.saveForm} onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <label className={styles.saveFormLabel}>Name</label>
          <input
            className={`${styles.saveInput} ${nameError ? styles.error : ''}`}
            value={templateName}
            onChange={e => { setTemplateName(e.target.value); if (nameError) setNameError(false); }}
            required
          />
          <label className={styles.saveFormLabel}>Description (optional)</label>
          <textarea
            className={styles.saveTextarea}
            rows={2}
            value={templateDesc}
            onChange={e => setTemplateDesc(e.target.value)}
          />
          <button type="button" className={styles.saveBtn} onClick={handleSave}>Save Layout as Template</button>
          {saveConfirm && <div className={styles.saveConfirm}>Saved!</div>}
          {canvasCleared && <div className={styles.saveConfirm}>Canvas cleared</div>}
        </form>
        <div className={styles.templateList}>
          {articleTemplates.length === 0 ? (
            <div className={styles.emptyLib}>No templates yet. Build a layout and save it.</div>
          ) : (
            articleTemplates.map(template => (
              <div key={template.id} className={styles.templateCard}>
                <div className={styles.templateName}>{template.name}</div>
                {template.description && (
                  <div className={styles.templateDesc} title={template.description}>{template.description}</div>
                )}
                <div className={styles.templateIcons}>
                  {template.blocks.map((b, i) => (
                    <span key={i} title={b.type}>/* placeholder icon mapping */🧩</span>
                  ))}
                </div>
                <div className={styles.templateActions}>
                  <button
                    className={styles.applyBtn}
                    onClick={() => {
                      setApplyForTemplate(template.id);
                      setApplyTarget('');
                    }}
                  >Apply to Entity</button>
                  <button className={styles.deleteBtn} onClick={() => deleteArticleTemplate(template.id)}>🗑</button>
                </div>
                {applyForTemplate === template.id && (
                  <div className={styles.entitySelector}>
                    <select
                      className={styles.entitySelect}
                      value={applyTarget}
                      onChange={e => setApplyTarget(e.target.value)}
                    >
                      <option value="">Select entity</option>
                      {entities.map(ent => (
                        <option key={ent.id} value={ent.id}>{ent.name} ({ent.type})</option>
                      ))}
                    </select>
                    <button className={styles.confirmApplyBtn} onClick={() => handleApply(template.id)} disabled={!applyTarget}>Apply</button>
                    {applyConfirm && <div className={styles.saveConfirm}>Applied!</div>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
      {/* CENTER CANVAS */}
      <div className={styles.canvasArea}>
        <ArticleGridEditor entityId={phantomIdRef.current} />
        <div className={styles.canvasHint}>Drag widgets onto the canvas to design a layout, then save it as a template</div>
      </div>
    </div>
  );
}
