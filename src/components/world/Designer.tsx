import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore, WorldBibleLayout, selectProjectWorldKey } from '@/store/workspaceStore';
import { GridWidget, ArticleTab, WidgetType, parseArticleTabs, StaticGridCanvas } from './ArticleGridEditor';
import ArticleGridEditor from './ArticleGridEditor';
import WorldBibleFolderTree from './WorldBibleFolderTree';
import styles from './Designer.module.css';
import { STANDALONE_KEY } from '@/lib/worldKey';

type DesignerMode = 'landing' | 'article' | 'hierarchy';

export default function Designer() {
  const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
  const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);
  const entities = useWorkspaceStore(state => state.entities);
  const addEntity = useWorkspaceStore(state => state.addEntity);
  const deleteEntity = useWorkspaceStore(state => state.deleteEntity);
  const updateEntityDoc = useWorkspaceStore(state => state.updateEntityDoc);
  const saveArticleTemplate = useWorkspaceStore(state => state.saveArticleTemplate);
  const articleTemplates = useWorkspaceStore(state => state.articleTemplates);
  const hierarchyTemplates = useWorkspaceStore(state => state.hierarchyTemplates);
  const saveHierarchyTemplate = useWorkspaceStore(state => state.saveHierarchyTemplate);
  const applyHierarchyTemplate = useWorkspaceStore(state => state.applyHierarchyTemplate);
  const projects = useWorkspaceStore(state => state.projects);
  const addWorldBibleRoot = useWorkspaceStore(state => state.addWorldBibleRoot);
  const updateProject = useWorkspaceStore(state => state.updateProject);
  const draftHierarchyLayout = useWorkspaceStore(state => state.draftHierarchyLayout);
  const setDraftHierarchyLayout = useWorkspaceStore(state => state.setDraftHierarchyLayout);
  const applyDraftHierarchy = useWorkspaceStore(state => state.applyDraftHierarchy);

  const [mode, setMode] = useState<DesignerMode>('landing');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // For Articles
  const phantomIdRef = useRef<string>('');
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [nameError, setNameError] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [applyConfirm, setApplyConfirm] = useState(false);

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<'article' | 'hierarchy' | null>(null);

  // Create phantom entity on mount
  useEffect(() => {
    const id = crypto.randomUUID();
    phantomIdRef.current = id;
    const phantomEntity = {
      id,
      projectId: activeProjectId ?? '',
      worldId: projectWorldKey === STANDALONE_KEY ? undefined : projectWorldKey,
      name: '__template_designer_canvas__',
      type: 'lore' as const,
      description: '',
      createdAt: new Date(),
      articleDoc: '',
    } as any;
    addEntity(phantomEntity);
    return () => {
      deleteEntity(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, projectWorldKey]);

  const phantomEntity = entities.find(e => e.id === phantomIdRef.current);

  const getCurrentWidgets = (): GridWidget[] => {
    if (!phantomEntity) return [];
    try {
      const tabs = parseArticleTabs(phantomEntity.articleDoc);
      const activeTab = tabs[0];
      return activeTab?.widgets ?? [];
    } catch {
      return [];
    }
  };

  const handleNewArticle = () => {
    updateEntityDoc(phantomIdRef.current, JSON.stringify([]));
    setTemplateName('');
    setTemplateDesc('');
    setEditingTemplateId(null);
    setMode('article');
    setActiveDropdown(null);
  };

  const handleEditArticle = (templateId: string) => {
    const t = articleTemplates.find(at => at.id === templateId);
    if (!t) return;
    
    // Load blocks into phantom entity
    const blocksJSON = JSON.stringify([{
      id: 'tab-1',
      name: 'Layout',
      widgets: t.blocks.map((b, idx) => ({
        id: crypto.randomUUID(),
        type: b.type,
        x: 40,
        y: 40 + (idx * 220),
        width: 600,
        height: 200,
        content: {}
      }))
    }]);
    
    updateEntityDoc(phantomIdRef.current, blocksJSON);
    setTemplateName(t.name);
    setTemplateDesc(t.description || '');
    setEditingTemplateId(t.id);
    setMode('article');
    setActiveDropdown(null);
  };

  const handleSaveArticle = () => {
    if (!templateName.trim()) {
      setNameError(true);
      return;
    }
    const widgets = getCurrentWidgets();
    saveArticleTemplate(templateName.trim(), templateDesc || undefined, widgets as any);
    setSaveConfirm(true);
    setTimeout(() => setSaveConfirm(false), 2000);
  };

  const handleNewHierarchy = () => {
    setMode('hierarchy');
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateDesc('');
    setActiveDropdown(null);

    // Seed the draft state with a default "World Bible" root
    setDraftHierarchyLayout({
      roots: [{
        id: crypto.randomUUID(),
        label: 'World Bible',
        icon: '📁',
        entityTypes: [],
        x: 100,
        y: 100
      }]
    });
  };

  const handleEditHierarchy = (templateId: string) => {
    const t = hierarchyTemplates.find(ht => ht.id === templateId);
    if (!t || !activeProjectId) return;
    
    setDraftHierarchyLayout(t.layout);
    setTemplateName(t.name);
    setTemplateDesc(t.description || '');
    setEditingTemplateId(t.id);
    setMode('hierarchy');
    setActiveDropdown(null);
  };

  const handleSaveHierarchy = () => {
    if (!templateName.trim()) {
      setNameError(true);
      return;
    }
    if (!draftHierarchyLayout) return;

    saveHierarchyTemplate(templateName.trim(), templateDesc || undefined, draftHierarchyLayout);
    setSaveConfirm(true);
    setTimeout(() => setSaveConfirm(false), 2000);
  };

  const handleApplyToProject = () => {
    applyDraftHierarchy();
    setApplyConfirm(true);
    setTimeout(() => setApplyConfirm(false), 2000);
  };

  const viewportRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.designerRoot}>
      {/* GLOBAL STUDIO HEADER */}
      <div className={styles.studioHeader}>
        <div className={styles.studioBrand} onClick={() => setMode('landing')}>
          <span className={styles.brandIcon}>🎨</span>
          <span className={styles.brandName}>Studio</span>
        </div>

        <nav className={styles.studioNav}>
          {/* ARTICLE TEMPLATES */}
          <div className={styles.navGroup}>
            <button 
              className={`${styles.navLabel} ${mode === 'article' ? styles.navActive : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'article' ? null : 'article')}
            >
              Article Templates
              <span className={styles.chevron}>{activeDropdown === 'article' ? '▴' : '▾'}</span>
            </button>
            {activeDropdown === 'article' && (
              <div className={styles.dropdown}>
                <button className={styles.dropdownAction} onClick={handleNewArticle}>
                  <span className={styles.actionIcon}>＋</span> New Template
                </button>
                <div className={styles.dropdownDivider} />
                <div className={styles.dropdownScroll}>
                  {articleTemplates.length === 0 && <div className={styles.emptyHint}>No templates saved</div>}
                  {articleTemplates.map(at => (
                    <button key={at.id} className={styles.dropdownItem} onClick={() => handleEditArticle(at.id)}>
                      {at.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* HIERARCHY TEMPLATES */}
          <div className={styles.navGroup}>
            <button 
              className={`${styles.navLabel} ${mode === 'hierarchy' ? styles.navActive : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'hierarchy' ? null : 'hierarchy')}
            >
              World Bible Templates
              <span className={styles.chevron}>{activeDropdown === 'hierarchy' ? '▴' : '▾'}</span>
            </button>
            {activeDropdown === 'hierarchy' && (
              <div className={styles.dropdown}>
                <button className={styles.dropdownAction} onClick={handleNewHierarchy}>
                  <span className={styles.actionIcon}>＋</span> New Hierarchy
                </button>
                <div className={styles.dropdownDivider} />
                <div className={styles.dropdownScroll}>
                  {hierarchyTemplates.length === 0 && <div className={styles.emptyHint}>No hierarchies saved</div>}
                  {hierarchyTemplates.map(ht => (
                    <button key={ht.id} className={styles.dropdownItem} onClick={() => handleEditHierarchy(ht.id)}>
                      {ht.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>

        {mode !== 'landing' && (
          <div className={styles.editorControls}>
            <div className={styles.vDivider} />
            <input 
              className={`${styles.templateTitleInput} ${nameError ? styles.error : ''}`}
              value={templateName}
              placeholder="Template name..."
              onChange={e => { setTemplateName(e.target.value); setNameError(false); }}
            />
            {mode === 'hierarchy' && (
              <button 
                className={styles.saveBtn} 
                style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.7rem', height: '28px', padding: '0 10px', marginLeft: '4px' }}
                onClick={handleApplyToProject}
              >
                {applyConfirm ? '✓ Applied' : 'Apply to Project'}
              </button>
            )}
            <button 
              className={styles.saveBtn} 
              onClick={mode === 'article' ? handleSaveArticle : handleSaveHierarchy}
            >
              {saveConfirm ? '✓ Saved' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <main className={styles.viewport} ref={viewportRef}>
        {/* GLOBAL BACKGROUND GRID */}
        <StaticGridCanvas containerRef={viewportRef} />

        {mode === 'landing' && (
          <div className={styles.landingContent} />
        )}

        {mode === 'article' && (
          <div className={styles.canvasArea}>
            <ArticleGridEditor entityId={phantomIdRef.current} hideGrid={true} />
          </div>
        )}

        {mode === 'hierarchy' && (
          <div className={styles.canvasArea}>
            <WorldBibleFolderTree isDraft={true} />
          </div>
        )}
      </main>
    </div>
  );
}
