/**
 * The contract every writing zone honours, so WritingZoneRenderer can hand the
 * same props to whichever one the project's medium calls for. LEAF MODULE.
 *
 * The zones are deliberate clones of one another — each medium gets its own
 * copy to diverge in. This type is the one thing they share, so the dispatcher
 * stays type-safe while the bodies drift apart.
 */

import type { DeskWidget, DeskWidgetType } from '@/store/workspaceStore';

export interface WritingZoneProps {
    content: any;
    onChange: (c: any) => void;
    onChangeImmediate?: (c: any) => void;
    widget: DeskWidget;
    onDragStart: (e: React.MouseEvent, w: DeskWidget) => void;
    onDeleteWidget: (id: string) => void;
    onDockChange: (dock: DeskWidget['dock']) => void;
    onManualSave: () => void;
    onAddAtCenter: (type: DeskWidgetType) => void;
}
