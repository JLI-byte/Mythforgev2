"use client";

import React, { useCallback } from 'react';
import { DeskWidget, DeskWidgetType } from '@/store/workspaceStore';
import { WritingZoneRenderer } from './WritingZoneRenderer';
import { StickyNoteRenderer } from './StickyNoteRenderer';
import { ReferenceCardRenderer } from './ReferenceCardRenderer';
import { ImagePinRenderer } from './ImagePinRenderer';
import { WorldBiblePinRenderer } from './WorldBiblePinRenderer';
import { SceneControlRenderer } from './SceneControlRenderer';
import { CharacterStateRenderer } from './CharacterStateRenderer';
import { ContinuityRenderer } from './ContinuityRenderer';
import { StructureRenderer } from './StructureRenderer';
import { ResearchRenderer } from './ResearchRenderer';
import { ProgressRenderer } from './ProgressRenderer';
import { RelationshipMapRenderer } from './RelationshipMapRenderer';
import { DraftNavRenderer } from './DraftNavRenderer';
import { BeatCardRenderer } from './BeatCardRenderer';
import { ArticleSuggestionsRenderer } from './ArticleSuggestionsRenderer';
import { ConsistencyFlagsRenderer } from './ConsistencyFlagsRenderer';
import { UnderstandingRenderer } from './UnderstandingRenderer';
import { UntypedWidgetRenderer } from './UntypedWidgetRenderer';
import { BoardCardRenderer } from './BoardCardRenderer';
import { ColumnRenderer } from './ColumnRenderer';
import { LinkCardRenderer } from './LinkCardRenderer';
import { TodoRenderer } from './TodoRenderer';
import { SwatchRenderer } from './SwatchRenderer';
import { DocumentRenderer } from './DocumentRenderer';
import { TableRenderer } from './TableRenderer';
import { DrawingRenderer } from './DrawingRenderer';

// ============================================================
// WIDGET RENDERERS
// ============================================================

export interface WidgetRendererProps {
  widget: DeskWidget;
  updateContentImmediate: (id: string, content: Record<string, any>) => void;
  updateContentSilent: (id: string, content: Record<string, any>) => void;
  handleDragStart: (e: React.MouseEvent, w: DeskWidget) => void;
  deleteWidget: (id: string) => void;
  updateWidgets: (next: DeskWidget[]) => void;
  widgetsRef: React.MutableRefObject<DeskWidget[]>;
  triggerSave: () => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  onAddAtCenter: (type: DeskWidgetType) => void;
  /** Research boards only: open a nested board from its card. */
  onOpenBoard?: (boardId: string) => void;
  /** Research boards only: select a card from inside its column. */
  onSelectChild?: (id: string) => void;
  /** The board's full widget list. A column draws its own children from it, so
   *  it must be the reactive array — a ref would not re-render on a new child. */
  allWidgets?: DeskWidget[];
  /** Research boards get the preview link card; the desk keeps the plain one. */
  isResearch?: boolean;
}

export const WidgetRenderer = React.memo(function WidgetRenderer({
  widget, updateContentImmediate, updateContentSilent,
  handleDragStart, deleteWidget, updateWidgets, widgetsRef, triggerSave, viewportRef, onAddAtCenter, onOpenBoard, onSelectChild, allWidgets, isResearch, onDockChange
}: WidgetRendererProps & { onDockChange: (dock: DeskWidget['dock']) => void }) {
  // Stable per-widget callbacks — recreated only when widget.id changes.
  // widget.content seeds each renderer's local useState on mount / external update.
  // From that point the renderer owns its local state; the store is the persistence
  // layer, updated only after the debounce flush.
  const handleChange = useCallback(
    (c: any) => updateContentSilent(widget.id, c),
    [updateContentSilent, widget.id]
  );
  const handleChangeImmediate = useCallback(
    (c: any) => updateContentImmediate(widget.id, c),
    [updateContentImmediate, widget.id]
  );
  const content = widget.content;
  switch (widget.type) {
    case 'writingZone': return <WritingZoneRenderer content={content} onChange={handleChange} onChangeImmediate={handleChangeImmediate} widget={widget} onDragStart={handleDragStart} onDeleteWidget={deleteWidget} onDockChange={onDockChange} onManualSave={triggerSave} onAddAtCenter={onAddAtCenter} />;
    case 'sticky':      return <StickyNoteRenderer content={content} onChange={handleChange} onChangeImmediate={handleChangeImmediate} />;
    case 'reference':   return isResearch
      ? <LinkCardRenderer content={content} onChange={handleChange} />
      : <ReferenceCardRenderer content={content} onChange={handleChange} />;
    case 'image':       return <ImagePinRenderer content={content} onChange={handleChange} onChangeImmediate={handleChangeImmediate} />;
    case 'biblePinit':  return <WorldBiblePinRenderer content={content} onChange={handleChange} />;
    case 'sceneControl':return <SceneControlRenderer content={content} onChange={handleChange} />;
    case 'characterState':return <CharacterStateRenderer content={content} onChange={handleChange} />;
    case 'continuity':  return <ContinuityRenderer content={content} onChange={handleChange} />;
    case 'structure':   return <StructureRenderer content={content} onChange={handleChange} />;
    case 'research':    return <ResearchRenderer content={content} onChange={handleChange} />;
    case 'progress':    return <ProgressRenderer content={content} onChange={handleChange} />;
    case 'relMap':      return <RelationshipMapRenderer content={content} onChange={handleChange} />;
    case 'draftNav':    return <DraftNavRenderer content={content} onChange={handleChange} />;
    case 'beatCard':    return <BeatCardRenderer content={content} onChange={handleChange} />;
    case 'articleSuggestions': return <ArticleSuggestionsRenderer content={content} onChange={handleChangeImmediate} />;
    case 'consistencyFlags': return <ConsistencyFlagsRenderer content={content} onChange={handleChangeImmediate} />;
    case 'worldUnderstanding': return <UnderstandingRenderer />;
    case 'board':       return <BoardCardRenderer content={content} onOpenBoard={onOpenBoard} />;
    case 'column':      return <ColumnRenderer widget={widget} allWidgets={allWidgets ?? []} content={content} onChange={handleChangeImmediate} onSelectChild={onSelectChild ?? (() => {})} />;
    case 'todo':        return <TodoRenderer content={content} onChange={handleChange} />;
    case 'document':    return <DocumentRenderer content={content} onChange={handleChange} />;
    case 'swatch':      return <SwatchRenderer content={content} onChange={handleChange} />;
    case 'table':       return <TableRenderer content={content} onChange={handleChange} />;
    case 'drawing':     return <DrawingRenderer content={content} onChange={handleChangeImmediate} />;
    case 'untyped':     return <UntypedWidgetRenderer />;
    default:            return null;
  }
});
