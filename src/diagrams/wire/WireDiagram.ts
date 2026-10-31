import { Diagram } from '../../core/Diagram';

export type WireFace = 'top' | 'bottom' | 'left' | 'right';

export function normalizeFace(face?: string): WireFace | undefined {
    if (!face) return undefined;
    const lower = face.toLowerCase();
    if (lower === 'top' || lower === 'n') return 'top';
    if (lower === 'bottom' || lower === 's') return 'bottom';
    if (lower === 'left' || lower === 'w') return 'left';
    if (lower === 'right' || lower === 'e') return 'right';
    return undefined;
}

export type ArrowDirection = 'forward' | 'backward' | 'bidirectional' | 'none';

export interface ArrowInfo {
    raw: string;
    direction: ArrowDirection;
    distance: number; // 1 for ->, 2 for -->, 3 for --->, etc.
    isDouble: boolean; // => or ==
}

export interface ProtocolInfo {
    name: string;
    raw: string;
    args?: string;
    params: Map<string, string>;
}

export interface WireComponent {
    id: string;
    label: string;
    boardId?: string;
    userWidth?: number;
    userHeight?: number;
    widthUnit?: 'px' | 'slots';
    heightUnit?: 'px' | 'slots';
    color?: string;
    note?: string;
    isEdge: boolean;
    edgeFace?: WireFace;
}

export interface WireBusChild {
    arrow: ArrowInfo;
    targetId: string;
    targetLabel?: string;
    targetFace?: WireFace;
    isEdge?: boolean;
    edgeFace?: WireFace;
    noteOrAddr?: string;
}

export interface WireConnection {
    id: string;
    sourceId: string;
    sourceFace?: WireFace;
    targetId: string;
    targetFace?: WireFace;
    arrow: ArrowInfo;
    protocol?: ProtocolInfo;
    connector?: string;
    note?: string;
    isBus?: boolean;
    busId?: string;
    busChildren?: WireBusChild[];
}

export interface WireBoard {
    id: string;
    label: string;
    note?: string;
    componentIds: string[];
}

export interface WireCallout {
    id: string;
    type: 'note' | 'warning';
    targetId: string;
    targetFace?: WireFace;
    nearId?: string;
    text: string;
}

export class WireDiagram implements Diagram {
    type = 'wire';
    boards = new Map<string, WireBoard>();
    components = new Map<string, WireComponent>();
    wires: WireConnection[] = [];
    callouts: WireCallout[] = [];

    getComponent(id: string): WireComponent | undefined {
        return this.components.get(id);
    }

    getOrCreateComponent(id: string, boardId?: string): WireComponent {
        let comp = this.components.get(id);
        if (!comp) {
            comp = {
                id,
                label: id,
                boardId,
                isEdge: false
            };
            this.components.set(id, comp);
            if (boardId) {
                const board = this.boards.get(boardId);
                if (board && !board.componentIds.includes(id)) {
                    board.componentIds.push(id);
                }
            }
        } else if (boardId && !comp.boardId) {
            comp.boardId = boardId;
            const board = this.boards.get(boardId);
            if (board && !board.componentIds.includes(id)) {
                board.componentIds.push(id);
            }
        }
        return comp;
    }
}
