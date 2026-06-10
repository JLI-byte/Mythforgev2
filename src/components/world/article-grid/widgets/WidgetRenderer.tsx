"use client";

import { GridWidget } from '../gridTypes';
import { UntypedWidget, TextWidget, HeadingWidget, ImageWidget, DividerWidget, QuoteWidget } from './BasicWidgets';
import { StatBlockWidget, TableWidget, GalleryWidget } from './DataWidgets';
import { TimelineWidget } from './TimelineWidget';
import { RelationshipWidget } from './RelationshipWidget';
import { FamilyTreeWidget } from './FamilyTreeWidget';
import { CharacterArcWidget } from './CharacterArcWidget';
import { OrgChartWidget } from './OrgChartWidget';
import { PronunciationWidget } from './PronunciationWidget';
import { SyllableWidget, LyricWidget } from './LyricWidgets';
import { SceneCardWidget } from './SceneCardWidget';

// ============================================================
// WIDGET RENDERERS
// ============================================================

export function WidgetRenderer({ widget, onChange }: { widget: GridWidget; onChange: (c: Record<string, any>) => void }) {
  switch (widget.type) {
    case 'text':      return <TextWidget content={widget.content} onChange={onChange} />;
    case 'heading':   return <HeadingWidget content={widget.content} onChange={onChange} />;
    case 'image':     return <ImageWidget content={widget.content} onChange={onChange} />;
    case 'divider':   return <DividerWidget />;
    case 'quote':     return <QuoteWidget content={widget.content} onChange={onChange} />;
    case 'statblock': return <StatBlockWidget content={widget.content} onChange={onChange} />;
    case 'table':     return <TableWidget content={widget.content} onChange={onChange} />;
    case 'gallery':   return <GalleryWidget content={widget.content} onChange={onChange} />;
    case 'timeline':  return <TimelineWidget content={widget.content} onChange={onChange} />;
    case 'relationship': return <RelationshipWidget content={widget.content} onChange={onChange} />;
    case 'familytree': return <FamilyTreeWidget content={widget.content} onChange={onChange} />;
    case 'characterarc': return <CharacterArcWidget content={widget.content} onChange={onChange} />;
    case 'orgchart': return <OrgChartWidget content={widget.content} onChange={onChange} />;
    case 'pronunciation': return <PronunciationWidget content={widget.content} onChange={onChange} />;
    case 'syllable': return <SyllableWidget content={widget.content} onChange={onChange} />;
    case 'lyric': return <LyricWidget content={widget.content} onChange={onChange} />;
    case 'scenecard': return <SceneCardWidget content={widget.content} onChange={onChange} />;
    case 'untyped':   return <UntypedWidget />;
    default:          return null;
  }
}
