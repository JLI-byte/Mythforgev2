// ============================================================
// DATA MODEL
// ============================================================

export type WidgetType = 'text' | 'heading' | 'image' | 'divider' | 'quote' | 'statblock' | 'table' | 'gallery' | 'untyped' | 'timeline' | 'relationship' | 'familytree' | 'characterarc' | 'orgchart' | 'pronunciation' | 'syllable' | 'lyric' | 'scenecard';

export interface GridWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: Record<string, any>;
  pinnedToSheet?: boolean;
}

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type GuideAxis = 'x' | 'y';

export interface AlignGuide {
  axis: GuideAxis;   // 'x' = vertical line, 'y' = horizontal line
  pos: number;       // canvas coordinate (px) where the line sits
}
