import { DeskWidgetType } from '@/store/workspaceStore';

export type BinderMode = 'shown' | 'hidden' | 'smart';

// =============================================
// TYPES & CONSTANTS
// =============================================

// Moved DeskWidget and DeskWidgetType to workspaceStore.ts


export const MIN_W = 160;
export const MIN_H = 100;

export const DEFAULT_DIMS: Record<DeskWidgetType, { w: number; h: number }> = {
  writingZone: { w: 900, h: 600 },
  sticky:      { w: 200, h: 200 },
  reference:   { w: 300, h: 400 },
  image:       { w: 300, h: 360 },
  biblePinit:  { w: 280, h: 380 },
  sceneControl: { w: 320, h: 540 },
  characterState: { w: 340, h: 580 },
  continuity: { w: 340, h: 600 },
  structure: { w: 380, h: 640 },
  research: { w: 420, h: 680 },
  progress: { w: 340, h: 480 },
  relMap: { w: 440, h: 540 },
  draftNav: { w: 340, h: 620 },
  untyped:     { w: 300, h: 200 },
};

export const PALETTE_ITEMS: { type: DeskWidgetType; icon: string; label: string }[] = [
  { type: 'writingZone', icon: '🖋️', label: 'Writing Zone' },
  { type: 'sticky',      icon: '📌', label: 'Sticky Note' },
  { type: 'reference',   icon: '🗂️', label: 'Ref Card' },
  { type: 'image',       icon: '🖼️', label: 'Image Pin' },
  { type: 'biblePinit',  icon: '📖', label: 'Bible Pin' },
  { type: 'sceneControl',icon: '🎬', label: 'Scene Control' },
  { type: 'characterState',icon: '👤', label: 'Character State' },
  { type: 'continuity',    icon: '⛓️', label: 'Continuity' },
  { type: 'structure',     icon: '🏗️', label: 'Structure' },
  { type: 'research',      icon: '🎨', label: 'Research' },
  { type: 'progress',      icon: '📈', label: 'Progress' },
  { type: 'relMap',        icon: '🕸️', label: 'Rel Map' },
  { type: 'draftNav',      icon: '🗺️', label: 'Draft Nav' },
];

export const PALETTE_MAP = Object.fromEntries(
  PALETTE_ITEMS.map(item => [item.type, item])
) as Record<DeskWidgetType, { type: DeskWidgetType; icon: string; label: string } | undefined>;

export const STICKY_COLORS: Record<string, string> = {
  yellow: '#fef08a',
  blue:   '#bfdbfe',
  green:  '#bbf7d0',
  pink:   '#fbcfe8',
  purple: '#ddd6fe',
};

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
