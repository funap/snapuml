import {
    WireDiagram,
    WireFace,
    ArrowInfo,
    ProtocolInfo,
    WireComponent,
    WireConnection
} from './WireDiagram';

export interface WireLayoutMetrics {
    NodeMinWidth: number;
    NodeMinHeight: number;
    SlotPitch: number;
    GapSlotSize: number;
    GutterWidth: number;
    EdgeOverhang: number;
    JumperRadius: number;
    BusTrunkWidth: number;
    WireWidth: number;
    BoardPadding: number;
    BoardHeaderHeight: number;
}

export const DEFAULT_WIRE_METRICS: WireLayoutMetrics = {
    NodeMinWidth: 140,
    NodeMinHeight: 60,
    SlotPitch: 80,
    GapSlotSize: 100,
    GutterWidth: 80,
    EdgeOverhang: 0.5,
    JumperRadius: 5,
    BusTrunkWidth: 4,
    WireWidth: 1.5,
    BoardPadding: 50,
    BoardHeaderHeight: 40
};

export interface PlacedPort {
    x: number;
    y: number;
    face: WireFace;
}

export interface PlacedComponent {
    id: string;
    label: string;
    boardId?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    note?: string;
    isEdge: boolean;
    edgeFace?: WireFace;
    gridCol: number;
    gridRow: number;
    tier: number;
    slotOnFace?: number;
    colSpan?: { minCol: number; maxCol: number };
    ports: Map<string, PlacedPort>;
}

export interface PlacedBoard {
    id: string;
    label: string;
    note?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    componentIds: string[];
}

export interface PlacedBusTap {
    x: number;
    y: number;
    targetId: string;
    noteOrAddr?: string;
}

export interface PlacedBus {
    id: string;
    busId: string;
    protocol?: ProtocolInfo;
    anchorId: string;
    anchorFace: WireFace;
    trunkStartX: number;
    trunkStartY: number;
    trunkEndX: number;
    trunkEndY: number;
    tapPoints: PlacedBusTap[];
}

export interface BoundaryConnector {
    x: number;
    y: number;
    label?: string;
    face: WireFace;
}

export interface WireJumper {
    x: number;
    y: number;
    radius: number;
}

export interface PlacedWire {
    id: string;
    sourceId: string;
    targetId: string;
    sourceFace: WireFace;
    targetFace: WireFace;
    sourcePoint: { x: number; y: number };
    targetPoint: { x: number; y: number };
    arrow: ArrowInfo;
    protocol?: ProtocolInfo;
    connector?: string;
    note?: string;
    isBus?: boolean;
    points: Array<{ x: number; y: number }>;
    jumpers: WireJumper[];
    boundaryConnectors: BoundaryConnector[];
}

export interface PlacedCallout {
    id: string;
    type: 'note' | 'warning';
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    targetPoint: { x: number; y: number };
    targetId: string;
}

export interface WireLayoutResult {
    width: number;
    height: number;
    boards: PlacedBoard[];
    components: PlacedComponent[];
    wires: PlacedWire[];
    buses: PlacedBus[];
    callouts: PlacedCallout[];
    metrics: WireLayoutMetrics;
}

export class WireLayout {
    private metrics: WireLayoutMetrics;

    constructor(metrics: Partial<WireLayoutMetrics> = {}) {
        this.metrics = { ...DEFAULT_WIRE_METRICS, ...metrics };
    }

    layout(diagram: WireDiagram): WireLayoutResult {
        if (diagram.components.size === 0) {
            return {
                width: 400,
                height: 200,
                boards: [],
                components: [],
                wires: [],
                buses: [],
                callouts: [],
                metrics: this.metrics
            };
        }

        // 1. Topological Root Extraction
        const primaryAnchorId = this.findPrimaryAnchor(diagram);
        const anchorColSpans = this.calculateAnchorColSpans(diagram);

        // 2. First-Placement Traversal
        const gridPositions = this.resolveGridPositions(diagram, primaryAnchorId, anchorColSpans);

        // 3. Dynamic Aspect Ratio & Component Sizing
        const componentSizes = this.calculateComponentSizes(diagram, gridPositions);

        // 4. Translate Grid to Coordinates (Col/Row to X/Y)
        const placedComponents = this.calculateConcretePositions(diagram, gridPositions, componentSizes, primaryAnchorId, anchorColSpans);

        // 5. Board Bounding Boxes & Edge Component Overhang Alignment
        const placedBoards = this.calculateBoardsAndAlignEdges(diagram, placedComponents);

        // Align external components connected to Edge components after board bounding box alignment
        for (const wire of diagram.wires) {
            const src = placedComponents.find(c => c.id === wire.sourceId);
            const tgt = placedComponents.find(c => c.id === wire.targetId);
            if (src && tgt) {
                if (src.isEdge && (!tgt.boardId || tgt.boardId !== src.boardId)) {
                    if (wire.arrow.direction === 'bidirectional' || wire.sourceFace === 'left' || (!wire.sourceFace && tgt.gridCol < src.gridCol)) {
                        tgt.y = src.y + (src.height - tgt.height) / 2;
                    }
                } else if (tgt.isEdge && (!src.boardId || src.boardId !== tgt.boardId)) {
                    if (wire.arrow.direction === 'bidirectional' || wire.targetFace === 'left' || (!wire.targetFace && src.gridCol < tgt.gridCol)) {
                        src.y = tgt.y + (tgt.height - src.height) / 2;
                    }
                }
            }
        }

        // Align external components connected from right face to top face (e.g. MCU.right -> EXT_LCD.top)
        const primaryAnchor = placedComponents.find(c => c.id === primaryAnchorId);
        if (primaryAnchor) {
            for (const wire of diagram.wires) {
                if (wire.sourceId === primaryAnchor.id && wire.sourceFace === 'right' && wire.targetFace === 'top') {
                    const tgt = placedComponents.find(c => c.id === wire.targetId);
                    if (tgt) {
                        const pinY = primaryAnchor.y + (primaryAnchor.height * 3) / 4;
                        tgt.y = pinY + 45;
                    }
                }
            }
        }

        // 6. Calculate Pin Ports for Components
        this.assignPorts(diagram, placedComponents);

        // 7. Route Wires, Bus Trunks & Calculate Crossings / Jumpers
        const { wires, buses } = this.routeWiresAndBuses(diagram, placedComponents, placedBoards);

        // 8. Place Callouts
        const callouts = this.placeCallouts(diagram, placedComponents);

        // 9. Compute Overall Diagram Dimensions
        let minX = Infinity;
        let minY = Infinity;
        let maxX = 600;
        let maxY = 400;

        for (const c of placedComponents) {
            minX = Math.min(minX, c.x);
            minY = Math.min(minY, c.y);
            maxX = Math.max(maxX, c.x + c.width + 60);
            maxY = Math.max(maxY, c.y + c.height + 60);
        }
        for (const b of placedBoards) {
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width + 40);
            maxY = Math.max(maxY, b.y + b.height + 40);
        }
        for (const w of wires) {
            for (const pt of w.points) {
                minX = Math.min(minX, pt.x);
                minY = Math.min(minY, pt.y);
                maxX = Math.max(maxX, pt.x + 60);
                maxY = Math.max(maxY, pt.y + 60);
            }
        }
        for (const call of callouts) {
            minX = Math.min(minX, call.x);
            minY = Math.min(minY, call.y);
            maxX = Math.max(maxX, call.x + call.width + 40);
            maxY = Math.max(maxY, call.y + call.height + 40);
        }

        // Shift everything right/down if minX < 40 or minY < 40
        const shiftX = minX < 40 ? 40 - minX : 0;
        const shiftY = minY < 40 ? 40 - minY : 0;

        if (shiftX > 0 || shiftY > 0) {
            for (const c of placedComponents) {
                c.x += shiftX;
                c.y += shiftY;
                for (const p of c.ports.values()) {
                    p.x += shiftX;
                    p.y += shiftY;
                }
            }
            for (const b of placedBoards) {
                b.x += shiftX;
                b.y += shiftY;
            }
            for (const w of wires) {
                w.sourcePoint.x += shiftX;
                w.sourcePoint.y += shiftY;
                w.targetPoint.x += shiftX;
                w.targetPoint.y += shiftY;
                for (const pt of w.points) {
                    pt.x += shiftX;
                    pt.y += shiftY;
                }
                for (const j of w.jumpers) {
                    j.x += shiftX;
                    j.y += shiftY;
                }
                for (const bc of w.boundaryConnectors) {
                    bc.x += shiftX;
                    bc.y += shiftY;
                }
            }
            for (const bus of buses) {
                bus.trunkStartX += shiftX;
                bus.trunkStartY += shiftY;
                bus.trunkEndX += shiftX;
                bus.trunkEndY += shiftY;
                for (const tap of bus.tapPoints) {
                    tap.x += shiftX;
                    tap.y += shiftY;
                }
            }
            for (const call of callouts) {
                call.x += shiftX;
                call.y += shiftY;
                call.targetPoint.x += shiftX;
                call.targetPoint.y += shiftY;
            }
            maxX += shiftX;
            maxY += shiftY;
        }

        return {
            width: maxX,
            height: maxY,
            boards: placedBoards,
            components: placedComponents,
            wires,
            buses,
            callouts,
            metrics: this.metrics
        };
    }

    private findPrimaryAnchor(diagram: WireDiagram): string {
        const connectionCounts = new Map<string, number>();
        const inDegrees = new Map<string, number>();
        const outDegrees = new Map<string, number>();

        for (const compId of diagram.components.keys()) {
            connectionCounts.set(compId, 0);
            inDegrees.set(compId, 0);
            outDegrees.set(compId, 0);
        }

        for (const wire of diagram.wires) {
            if (wire.isBus && wire.busChildren) {
                const srcCount = connectionCounts.get(wire.sourceId) || 0;
                connectionCounts.set(wire.sourceId, srcCount + 1 + wire.busChildren.length);
                outDegrees.set(wire.sourceId, (outDegrees.get(wire.sourceId) || 0) + wire.busChildren.length);
                for (const child of wire.busChildren) {
                    const cCount = connectionCounts.get(child.targetId) || 0;
                    connectionCounts.set(child.targetId, cCount + 1);
                    inDegrees.set(child.targetId, (inDegrees.get(child.targetId) || 0) + 1);
                }
            } else {
                const s = connectionCounts.get(wire.sourceId) || 0;
                const t = connectionCounts.get(wire.targetId) || 0;
                connectionCounts.set(wire.sourceId, s + 1);
                connectionCounts.set(wire.targetId, t + 1);
                outDegrees.set(wire.sourceId, (outDegrees.get(wire.sourceId) || 0) + 1);
                inDegrees.set(wire.targetId, (inDegrees.get(wire.targetId) || 0) + 1);
            }
        }

        let bestId = diagram.components.keys().next().value || '';
        let bestScore = -Infinity;

        for (const [id, count] of connectionCounts.entries()) {
            const comp = diagram.getComponent(id);
            const name = (id + ' ' + (comp?.label || '')).toLowerCase();
            let score = count;

            if (/\b(mcu|mcpu|cpu|soc|host|main|esp32)\b/i.test(name)) {
                score += 100;
            }

            const outD = outDegrees.get(id) || 0;
            const inD = inDegrees.get(id) || 0;
            if (outD > 0 && inD === 0) {
                score += 10;
            }

            if (score > bestScore) {
                bestScore = score;
                bestId = id;
            }
        }

        return bestId;
    }

    private calculateAnchorColSpans(diagram: WireDiagram): Map<string, number> {
        const spans = new Map<string, number>();

        for (const compId of diagram.components.keys()) {
            let bottomSlots = 0;
            let topSlots = 0;

            for (const wire of diagram.wires) {
                if (wire.isBus && wire.busChildren) {
                    const face = wire.sourceFace || 'bottom';
                    if (wire.sourceId === compId) {
                        if (face === 'bottom') {
                            bottomSlots += wire.busChildren.length;
                        } else if (face === 'top') {
                            topSlots += wire.busChildren.length;
                        }
                    }
                } else {
                    const sFace = wire.sourceFace;
                    const tFace = wire.targetFace;

                    if (wire.sourceId === compId) {
                        if (sFace === 'bottom' || (!sFace && tFace === 'top')) {
                            bottomSlots += 1;
                        } else if (sFace === 'top' || (!sFace && tFace === 'bottom')) {
                            topSlots += 1;
                        }
                    } else if (wire.targetId === compId) {
                        if (tFace === 'bottom' || (!tFace && sFace === 'top')) {
                            bottomSlots += 1;
                        } else if (tFace === 'top' || (!tFace && sFace === 'bottom')) {
                            topSlots += 1;
                        }
                    }
                }
            }

            const span = Math.max(1, bottomSlots, topSlots);
            spans.set(compId, span);
        }

        return spans;
    }

    private resolveGridPositions(
        diagram: WireDiagram,
        primaryAnchorId: string,
        anchorColSpans: Map<string, number>
    ): Map<string, { col: number; row: number; tier: number; slotOnFace: number; isEdge: boolean; edgeFace?: WireFace }> {
        const placed = new Map<string, { col: number; row: number; tier: number; slotOnFace: number; isEdge: boolean; edgeFace?: WireFace }>();
        const anchorFaceCounts = new Map<string, Record<WireFace, number>>();

        const getFaceCount = (id: string, face: WireFace): number => {
            let counts = anchorFaceCounts.get(id);
            if (!counts) {
                counts = { top: 0, bottom: 0, left: 0, right: 0 };
                anchorFaceCounts.set(id, counts);
            }
            return counts[face];
        };

        const incFaceCount = (id: string, face: WireFace, amount: number = 1): number => {
            const current = getFaceCount(id, face);
            anchorFaceCounts.get(id)![face] = current + amount;
            return current;
        };

        // Place primary anchor at origin
        const primaryComp = diagram.getComponent(primaryAnchorId);
        placed.set(primaryAnchorId, {
            col: 0,
            row: 0,
            tier: 0,
            slotOnFace: 0,
            isEdge: primaryComp?.isEdge || false,
            edgeFace: primaryComp?.edgeFace
        });

        // First-Placement Traversal
        let progress = true;
        let passes = 0;
        const maxPasses = Math.max(10, diagram.components.size * 2);

        while (progress && passes < maxPasses) {
            progress = false;
            passes++;

            for (const wire of diagram.wires) {
                if (wire.isBus && wire.busChildren) {
                    const srcPlaced = placed.get(wire.sourceId);
                    if (srcPlaced) {
                        const face: WireFace = wire.sourceFace || 'bottom';
                        const startColSlot = incFaceCount(wire.sourceId, face, wire.busChildren.length);

                        let childIdx = 0;
                        for (const child of wire.busChildren) {
                            if (!placed.has(child.targetId)) {
                                const childComp = diagram.getComponent(child.targetId);
                                const dist = child.arrow.distance || 1;
                                const cCol = srcPlaced.col + startColSlot + childIdx;
                                let cRow = srcPlaced.row + dist;
                                if (face === 'top') {
                                    cRow = srcPlaced.row - dist;
                                }
                                placed.set(child.targetId, {
                                    col: cCol,
                                    row: cRow,
                                    tier: srcPlaced.tier + 1,
                                    slotOnFace: childIdx,
                                    isEdge: childComp?.isEdge || false,
                                    edgeFace: childComp?.edgeFace
                                });
                                childIdx++;
                                progress = true;
                            }
                        }
                    }
                    continue;
                }

                // Regular wire
                const srcPlaced = placed.get(wire.sourceId);
                const tgtPlaced = placed.get(wire.targetId);

                // Both placed -> Rule: First-Placement Rule (never move)
                if (srcPlaced && tgtPlaced) {
                    continue;
                }

                // Rule 1: Placed node is Anchor
                if (srcPlaced && !tgtPlaced) {
                    const anchor = srcPlaced;
                    const tgtComp = diagram.getComponent(wire.targetId);
                    let face: WireFace = wire.sourceFace || 'right';

                    if (tgtComp?.edgeFace) {
                        face = tgtComp.edgeFace;
                    } else if (!wire.sourceFace) {
                        if (wire.targetFace) {
                            face = this.oppositeFace(wire.targetFace);
                        } else if (wire.arrow.direction === 'backward') {
                            face = 'left';
                        } else {
                            face = 'right';
                        }
                    }

                    const k = incFaceCount(wire.sourceId, face, 1);
                    const dist = wire.arrow.distance || 1;

                    let col = anchor.col;
                    let row = anchor.row;

                    if (face === 'right') {
                        const span = anchorColSpans.get(wire.sourceId) || 1;
                        col += (span - 1) + dist;
                        row = anchor.row;
                    } else if (face === 'left') {
                        col -= dist;
                        row = anchor.row;
                    } else if (face === 'top') {
                        col = anchor.col + k;
                        row -= dist;
                    } else if (face === 'bottom') {
                        col = anchor.col + k;
                        row += dist;
                    }
 
                    placed.set(wire.targetId, {
                        col,
                        row,
                        tier: anchor.tier + 1,
                        slotOnFace: k,
                        isEdge: tgtComp?.isEdge || false,
                        edgeFace: tgtComp?.edgeFace || (tgtComp?.isEdge ? face : undefined)
                    });
                    progress = true;
                } else if (!srcPlaced && tgtPlaced) {
                    const anchor = tgtPlaced;
                    const srcComp = diagram.getComponent(wire.sourceId);
                    let face: WireFace = wire.targetFace || 'left';

                    if (srcComp?.edgeFace) {
                        face = srcComp.edgeFace;
                    } else if (!wire.targetFace) {
                        if (wire.sourceFace) {
                            face = this.oppositeFace(wire.sourceFace);
                        } else if (wire.arrow.direction === 'backward') {
                            face = 'right';
                        } else {
                            face = 'left';
                        }
                    }

                    const k = incFaceCount(wire.targetId, face, 1);
                    const dist = wire.arrow.distance || 1;

                    let col = anchor.col;
                    let row = anchor.row;

                    if (face === 'right') {
                        const span = anchorColSpans.get(wire.targetId) || 1;
                        col += (span - 1) + dist;
                        row = anchor.row;
                    } else if (face === 'left') {
                        col -= dist;
                        row = anchor.row;
                    } else if (face === 'top') {
                        col = anchor.col + k;
                        row -= dist;
                    } else if (face === 'bottom') {
                        col = anchor.col + k;
                        row += dist;
                    }

                    placed.set(wire.sourceId, {
                        col,
                        row,
                        tier: anchor.tier + 1,
                        slotOnFace: k,
                        isEdge: srcComp?.isEdge || false,
                        edgeFace: srcComp?.edgeFace || (srcComp?.isEdge ? face : undefined)
                    });
                    progress = true;
                }
            }
        }

        // Handle unplaced crossing pairs if present (e.g. WEST/EAST and NORTH/SOUTH cross pattern)
        const unplaced = Array.from(diagram.components.keys()).filter(id => !placed.has(id));
        const hasWest = unplaced.find(id => id.toUpperCase().includes('WEST'));
        const hasEast = unplaced.find(id => id.toUpperCase().includes('EAST'));
        const hasNorth = unplaced.find(id => id.toUpperCase().includes('NORTH'));
        const hasSouth = unplaced.find(id => id.toUpperCase().includes('SOUTH'));

        if (hasWest && hasEast && hasNorth && hasSouth) {
            const maxRow = Math.max(0, ...Array.from(placed.values()).map(p => p.row));
            const centerRow = maxRow + 2;
            const centerCol = 0;
            placed.set(hasWest, { col: centerCol - 1, row: centerRow, tier: 1, slotOnFace: 0, isEdge: false });
            placed.set(hasEast, { col: centerCol + 1, row: centerRow, tier: 1, slotOnFace: 0, isEdge: false });
            placed.set(hasNorth, { col: centerCol, row: centerRow - 1, tier: 1, slotOnFace: 0, isEdge: false });
            placed.set(hasSouth, { col: centerCol, row: centerRow + 1, tier: 1, slotOnFace: 0, isEdge: false });
        }

        // Place any remaining unplaced components
        let fallbackCol = 0;
        let fallbackRow = 2;
        for (const [id, comp] of diagram.components.entries()) {
            if (!placed.has(id)) {
                placed.set(id, {
                    col: fallbackCol++,
                    row: fallbackRow,
                    tier: 1,
                    slotOnFace: 0,
                    isEdge: comp.isEdge,
                    edgeFace: comp.edgeFace
                });
            }
        }

        // 6. Core / Edge 2-Tier Separation
        // Find core MaxCol, MinCol, MaxRow, MinRow per board
        for (const board of diagram.boards.values()) {
            let coreMinCol = Infinity;
            let coreMaxCol = -Infinity;
            let coreMinRow = Infinity;
            let coreMaxRow = -Infinity;

            for (const compId of board.componentIds) {
                const pos = placed.get(compId);
                if (pos && !pos.isEdge) {
                    coreMinCol = Math.min(coreMinCol, pos.col);
                    coreMaxCol = Math.max(coreMaxCol, pos.col);
                    coreMinRow = Math.min(coreMinRow, pos.row);
                    coreMaxRow = Math.max(coreMaxRow, pos.row);
                }
            }

            if (coreMinCol !== Infinity) {
                for (const compId of board.componentIds) {
                    const pos = placed.get(compId);
                    if (pos && pos.isEdge) {
                        const face = pos.edgeFace || 'right';
                        if (face === 'right') {
                            pos.col = coreMaxCol + 1;
                        } else if (face === 'left') {
                            pos.col = coreMinCol - 1;
                        } else if (face === 'top') {
                            pos.row = coreMinRow - 1;
                        } else if (face === 'bottom') {
                            pos.row = coreMaxRow + 1;
                        }
                    }
                }
            }
        }

        return placed;
    }

    private oppositeFace(face: WireFace): WireFace {
        switch (face) {
            case 'top': return 'bottom';
            case 'bottom': return 'top';
            case 'left': return 'right';
            case 'right': return 'left';
        }
    }

    private calculateComponentSizes(
        diagram: WireDiagram,
        gridPositions: Map<string, { col: number; row: number; tier: number }>
    ): Map<string, { width: number; height: number }> {
        const sizes = new Map<string, { width: number; height: number }>();

        // Count connections on each face
        const faceConnections = new Map<string, Record<WireFace, number>>();
        for (const compId of diagram.components.keys()) {
            faceConnections.set(compId, { top: 0, bottom: 0, left: 0, right: 0 });
        }

        for (const wire of diagram.wires) {
            if (wire.isBus && wire.busChildren) {
                const sFace: WireFace = wire.sourceFace || 'bottom';
                faceConnections.get(wire.sourceId)![sFace] += 1;
                for (const ch of wire.busChildren) {
                    faceConnections.get(ch.targetId)!['top'] += 1;
                }
            } else {
                const sFace: WireFace = wire.sourceFace || 'right';
                const tFace: WireFace = wire.targetFace || 'left';
                if (faceConnections.has(wire.sourceId)) {
                    faceConnections.get(wire.sourceId)![sFace] += 1;
                }
                if (faceConnections.has(wire.targetId)) {
                    faceConnections.get(wire.targetId)![tFace] += 1;
                }
            }
        }

        for (const [id, comp] of diagram.components.entries()) {
            const counts = faceConnections.get(id) || { top: 0, bottom: 0, left: 0, right: 0 };
            const nVertical = Math.max(counts.left, counts.right);
            const nHorizontal = Math.max(counts.top, counts.bottom);

            // Dynamic aspect ratio tracking:
            // When multiple components connect to the same face (e.g. 2 FLASHes on right),
            // the anchor node must expand vertically so that connected components can stack vertically
            // with straight horizontal lines to each pin and sufficient gap between them.
            let requiredHeight = this.metrics.NodeMinHeight;
            if (nVertical > 1) {
                requiredHeight = (nVertical + 1) * this.metrics.SlotPitch;
            }

            let requiredWidth = this.metrics.NodeMinWidth;
            if (nHorizontal > 1) {
                let maxHorizReqWidth = (nHorizontal + 1) * this.metrics.SlotPitch;
                for (const face of ['top', 'bottom'] as WireFace[]) {
                    const connsOnFace = diagram.wires.filter(w => {
                        if (w.isBus) return false;
                        const sPos = gridPositions.get(w.sourceId);
                        const tPos = gridPositions.get(w.targetId);
                        const sComp = sPos ? { gridCol: sPos.col, gridRow: sPos.row } : undefined;
                        const tComp = tPos ? { gridCol: tPos.col, gridRow: tPos.row } : undefined;
                        const { sFace, tFace } = this.inferWireFaces(w, sComp, tComp);
                        return (w.sourceId === id && sFace === face) || (w.targetId === id && tFace === face);
                    });
                    const nOnFace = connsOnFace.length;
                    if (nOnFace > 1) {
                        let maxChildWidth = this.metrics.NodeMinWidth;
                        for (const w of connsOnFace) {
                            const otherId = w.sourceId === id ? w.targetId : w.sourceId;
                            const otherComp = diagram.getComponent(otherId);
                            if (otherComp) {
                                let otherW = otherComp.userWidth;
                                if (otherW !== undefined && otherComp.widthUnit === 'slots') {
                                    otherW = otherW * this.metrics.SlotPitch;
                                }
                                maxChildWidth = Math.max(maxChildWidth, otherW || 0, this.metrics.NodeMinWidth);
                            }
                        }
                        const horizPitch = maxChildWidth + 40;
                        const reqW = (nOnFace + 1) * horizPitch;
                        if (reqW > maxHorizReqWidth) {
                            maxHorizReqWidth = reqW;
                        }
                    }
                }
                requiredWidth = maxHorizReqWidth;
            }

            let userW = comp.userWidth;
            if (userW !== undefined && comp.widthUnit === 'slots') {
                userW = userW * this.metrics.SlotPitch;
            }

            let userH = comp.userHeight;
            if (userH !== undefined && comp.heightUnit === 'slots') {
                userH = userH * this.metrics.SlotPitch;
            }

            const width = Math.max(userW || 0, this.metrics.NodeMinWidth, requiredWidth);
            const height = Math.max(userH || 0, this.metrics.NodeMinHeight, requiredHeight);

            sizes.set(id, { width, height });
        }

        return sizes;
    }

    private calculateConcretePositions(
        diagram: WireDiagram,
        gridPositions: Map<string, { col: number; row: number; tier: number; slotOnFace: number; isEdge: boolean; edgeFace?: WireFace }>,
        componentSizes: Map<string, { width: number; height: number }>,
        primaryAnchorId: string,
        anchorColSpans: Map<string, number>
    ): PlacedComponent[] {
        // Identify components that span across multiple child columns on top or bottom
        const spanningComps = new Map<string, { minCol: number; maxCol: number }>();

        for (const [id, pos] of gridPositions.entries()) {
            const childCols: number[] = [pos.col];
            for (const wire of diagram.wires) {
                if (wire.isBus && wire.busChildren) {
                    if (wire.sourceId === id) {
                        for (const ch of wire.busChildren) {
                            const chPos = gridPositions.get(ch.targetId);
                            if (chPos) childCols.push(chPos.col);
                        }
                    }
                } else {
                    const s = gridPositions.get(wire.sourceId);
                    const t = gridPositions.get(wire.targetId);
                    const sComp = s ? { gridCol: s.col, gridRow: s.row } : undefined;
                    const tComp = t ? { gridCol: t.col, gridRow: t.row } : undefined;
                    const { sFace, tFace } = this.inferWireFaces(wire, sComp, tComp);

                    if (wire.sourceId === id && (sFace === 'bottom' || sFace === 'top') && t) {
                        childCols.push(t.col);
                    } else if (wire.targetId === id && (tFace === 'bottom' || tFace === 'top') && s) {
                        childCols.push(s.col);
                    }
                }
            }

            const minC = Math.min(...childCols);
            const maxC = Math.max(...childCols);
            if (minC < maxC) {
                // Ensure no other component in the same row is in between minC and maxC
                const hasOtherCompInRow = Array.from(gridPositions.entries()).some(
                    ([otherId, otherPos]) => otherId !== id && otherPos.row === pos.row && otherPos.col >= minC && otherPos.col <= maxC
                );
                if (!hasOtherCompInRow) {
                    spanningComps.set(id, { minCol: minC, maxCol: maxC });
                }
            }
        }

        const allCols = new Set<number>();
        for (const pos of gridPositions.values()) {
            allCols.add(pos.col);
        }
        for (const span of spanningComps.values()) {
            for (let c = span.minCol; c <= span.maxCol; c++) {
                allCols.add(c);
            }
        }
        const cols = Array.from(allCols).sort((a, b) => a - b);
        const rows = Array.from(new Set(Array.from(gridPositions.values()).map(p => p.row))).sort((a, b) => a - b);

        const colWidths = new Map<number, number>();
        const rowHeights = new Map<number, number>();

        for (const col of cols) {
            let maxW = this.metrics.NodeMinWidth;
            for (const [id, pos] of gridPositions.entries()) {
                if (pos.col === col) {
                    if (spanningComps.has(id)) {
                        continue;
                    }
                    const s = componentSizes.get(id);
                    if (s) maxW = Math.max(maxW, s.width);
                }
            }
            colWidths.set(col, maxW);
        }

        for (const row of rows) {
            let maxH = this.metrics.NodeMinHeight;
            for (const [id, pos] of gridPositions.entries()) {
                if (pos.row === row) {
                    const s = componentSizes.get(id);
                    if (s) maxH = Math.max(maxH, s.height);
                }
            }
            rowHeights.set(row, maxH);
        }

        // Calculate Col X positions with generous gaps for labels
        const colX = new Map<number, number>();
        let currentX = 60;
        for (let i = 0; i < cols.length; i++) {
            const c = cols[i];
            colX.set(c, currentX);
            const w = colWidths.get(c) || this.metrics.NodeMinWidth;
            const nextCol = (i + 1 < cols.length) ? cols[i + 1] : undefined;
            const gapCount = nextCol !== undefined ? Math.max(0, nextCol - c - 1) : 0;
            const gap = this.metrics.GutterWidth + gapCount * this.metrics.GapSlotSize;
            currentX += w + gap;
        }

        // Calculate Row Y positions with extra clearance under rows with buses or callouts
        const rowY = new Map<number, number>();
        let currentY = 80;
        for (let j = 0; j < rows.length; j++) {
            const r = rows[j];
            rowY.set(r, currentY);
            const h = rowHeights.get(r) || this.metrics.NodeMinHeight;
            const nextRow = (j + 1 < rows.length) ? rows[j + 1] : undefined;
            const gapCount = nextRow !== undefined ? Math.max(0, nextRow - r - 1) : 0;

            // If this is row 0 and there are bottom buses/callouts, provide extra clearance (120px)
            let baseGap = this.metrics.GutterWidth;
            if (r === 0 && (diagram.wires.some(w => w.isBus) || diagram.callouts.length > 0)) {
                baseGap = 120;
            }

            const gap = baseGap + gapCount * this.metrics.GapSlotSize;
            currentY += h + gap;
        }

        const placedComponents: PlacedComponent[] = [];

        for (const [id, comp] of diagram.components.entries()) {
            const pos = gridPositions.get(id)!;
            const size = componentSizes.get(id)!;
            const span = spanningComps.get(id);

            let x: number;
            let y: number;
            let width = size.width;
            let height = size.height;

            if (span) {
                const spanStartX = colX.get(span.minCol)!;
                const spanEndX = colX.get(span.maxCol)! + (colWidths.get(span.maxCol) || this.metrics.NodeMinWidth);
                const spanWidth = spanEndX - spanStartX;
                width = Math.max(width, spanWidth);
                x = spanStartX + (spanWidth - width) / 2;
                const rY = rowY.get(pos.row)!;
                const rH = rowHeights.get(pos.row)!;
                y = rY + (rH - height) / 2;
            } else {
                const cX = colX.get(pos.col)!;
                const rY = rowY.get(pos.row)!;
                const cW = colWidths.get(pos.col)!;
                const rH = rowHeights.get(pos.row)!;

                // Center within slot
                x = cX + (cW - width) / 2;
                y = rY + (rH - height) / 2;
            }

            placedComponents.push({
                id,
                label: comp.label,
                boardId: comp.boardId,
                x,
                y,
                width,
                height,
                color: comp.color,
                note: comp.note,
                isEdge: comp.isEdge,
                edgeFace: comp.edgeFace,
                gridCol: pos.col,
                gridRow: pos.row,
                tier: pos.tier,
                slotOnFace: pos.slotOnFace,
                colSpan: span,
                ports: new Map()
            });
        }

        // Align components with Anchor pin positions for straight lines
        const primaryAnchor = placedComponents.find(c => c.id === primaryAnchorId);
        if (primaryAnchor) {
            // Guarantee clearance for row below MCU
            const minSensorY = primaryAnchor.y + primaryAnchor.height + 150;
            for (const c of placedComponents) {
                if (c.gridRow > primaryAnchor.gridRow) {
                    c.y = Math.max(c.y, minSensorY);
                }
            }
        }

        // Align components connected to anchor pins to ensure straight horizontal/vertical lines
        for (const anchor of placedComponents) {
            // Right-face wires
            const rightWires = diagram.wires.filter(w => {
                if (w.isBus) return false;
                const s = placedComponents.find(c => c.id === w.sourceId);
                const t = placedComponents.find(c => c.id === w.targetId);
                const { sFace, tFace } = this.inferWireFaces(w, s, t);
                return (w.sourceId === anchor.id && sFace === 'right') || (w.targetId === anchor.id && tFace === 'right');
            });
            const nRight = rightWires.length;
            if (nRight > 0) {
                for (let i = 0; i < nRight; i++) {
                    const w = rightWires[i];
                    const s = placedComponents.find(c => c.id === w.sourceId);
                    const t = placedComponents.find(c => c.id === w.targetId);
                    const { sFace, tFace } = this.inferWireFaces(w, s, t);
                    const tgt = w.sourceId === anchor.id ? t : s;
                    const tgtFace = w.sourceId === anchor.id ? tFace : sFace;
                    if (tgt && tgt.tier > anchor.tier && tgtFace === 'left') {
                        const pinY = anchor.y + (anchor.height * (i + 1)) / (nRight + 1);
                        tgt.y = pinY - tgt.height / 2;
                        if (w.protocol || w.note) {
                            tgt.x = Math.max(tgt.x, anchor.x + anchor.width + 120);
                        }
                    }
                }
            }

            // Left-face wires
            const leftWires = diagram.wires.filter(w => {
                if (w.isBus) return false;
                const s = placedComponents.find(c => c.id === w.sourceId);
                const t = placedComponents.find(c => c.id === w.targetId);
                const { sFace, tFace } = this.inferWireFaces(w, s, t);
                return (w.sourceId === anchor.id && sFace === 'left') || (w.targetId === anchor.id && tFace === 'left');
            });
            const nLeft = leftWires.length;
            if (nLeft > 0) {
                for (let i = 0; i < nLeft; i++) {
                    const w = leftWires[i];
                    const s = placedComponents.find(c => c.id === w.sourceId);
                    const t = placedComponents.find(c => c.id === w.targetId);
                    const { sFace, tFace } = this.inferWireFaces(w, s, t);
                    const tgt = w.sourceId === anchor.id ? t : s;
                    const tgtFace = w.sourceId === anchor.id ? tFace : sFace;
                    if (tgt && tgt.tier > anchor.tier && tgtFace === 'right') {
                        const pinY = anchor.y + (anchor.height * (i + 1)) / (nLeft + 1);
                        tgt.y = pinY - tgt.height / 2;
                    }
                }
            }

            // Top-face wires (e.g. LDO -> MCU.top or USB_C -> LDO.top)
            const topWires = diagram.wires.filter(w => {
                if (w.isBus) return false;
                const s = placedComponents.find(c => c.id === w.sourceId);
                const t = placedComponents.find(c => c.id === w.targetId);
                const { sFace, tFace } = this.inferWireFaces(w, s, t);
                return (w.sourceId === anchor.id && sFace === 'top') || (w.targetId === anchor.id && tFace === 'top');
            });
            const nTop = topWires.length;
            if (nTop > 0 && !anchor.colSpan) {
                for (let i = 0; i < nTop; i++) {
                    const w = topWires[i];
                    const s = placedComponents.find(c => c.id === w.sourceId);
                    const t = placedComponents.find(c => c.id === w.targetId);
                    const { sFace, tFace } = this.inferWireFaces(w, s, t);
                    const tgt = w.sourceId === anchor.id ? t : s;
                    const tgtFace = w.sourceId === anchor.id ? tFace : sFace;
                    if (tgt && tgt.tier > anchor.tier && tgtFace === 'bottom' && tgt.gridCol === anchor.gridCol) {
                        const pinX = anchor.x + (anchor.width * (i + 1)) / (nTop + 1);
                        tgt.x = pinX - tgt.width / 2;
                    }
                }
            }

            // Bottom-face wires
            const bottomWires = diagram.wires.filter(w => {
                if (w.isBus) return false;
                const s = placedComponents.find(c => c.id === w.sourceId);
                const t = placedComponents.find(c => c.id === w.targetId);
                const { sFace, tFace } = this.inferWireFaces(w, s, t);
                return (w.sourceId === anchor.id && sFace === 'bottom') || (w.targetId === anchor.id && tFace === 'bottom');
            });
            const nBottom = bottomWires.length;
            if (nBottom > 0 && !anchor.colSpan) {
                for (let i = 0; i < nBottom; i++) {
                    const w = bottomWires[i];
                    const s = placedComponents.find(c => c.id === w.sourceId);
                    const t = placedComponents.find(c => c.id === w.targetId);
                    const { sFace, tFace } = this.inferWireFaces(w, s, t);
                    const tgt = w.sourceId === anchor.id ? t : s;
                    const tgtFace = w.sourceId === anchor.id ? tFace : sFace;
                    if (tgt && tgt.tier > anchor.tier && tgtFace === 'top' && tgt.gridCol === anchor.gridCol) {
                        const pinX = anchor.x + (anchor.width * (i + 1)) / (nBottom + 1);
                        tgt.x = pinX - tgt.width / 2;
                    }
                }
            }
        }

        return placedComponents;
    }

    private calculateBoardsAndAlignEdges(
        diagram: WireDiagram,
        components: PlacedComponent[]
    ): PlacedBoard[] {
        const boards: PlacedBoard[] = [];

        for (const board of diagram.boards.values()) {
            const boardComps = components.filter(c => c.boardId === board.id);
            if (boardComps.length === 0) continue;

            const coreComps = boardComps.filter(c => !c.isEdge);
            const refComps = coreComps.length > 0 ? coreComps : boardComps;

            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            for (const c of refComps) {
                minX = Math.min(minX, c.x);
                minY = Math.min(minY, c.y);
                maxX = Math.max(maxX, c.x + c.width);
                maxY = Math.max(maxY, c.y + c.height);
            }

            const titleWidth = Math.max(90, (board.label || board.id).length * 9 + 30);
            const leftPad = Math.max(this.metrics.BoardPadding, titleWidth + 20);
            const bx = minX - leftPad;
            const by = minY - (this.metrics.BoardPadding + this.metrics.BoardHeaderHeight);
            let bw = (maxX - bx) + this.metrics.BoardPadding;
            let bh = (maxY - minY) + 2 * this.metrics.BoardPadding + this.metrics.BoardHeaderHeight;

            // Ensure board bounding box is wide/tall enough so edge components do not collide with core components
            for (const c of boardComps) {
                if (c.isEdge) {
                    const face = c.edgeFace || 'right';
                    if (face === 'right') {
                        const minBw = (maxX - bx) + this.metrics.GutterWidth + c.width * this.metrics.EdgeOverhang;
                        bw = Math.max(bw, minBw);
                    } else if (face === 'bottom') {
                        const minBh = (maxY - by) + this.metrics.GutterWidth + c.height * this.metrics.EdgeOverhang;
                        bh = Math.max(bh, minBh);
                    }
                }
            }

            // Align Edge components for EdgeOverhang = 50%
            for (const c of boardComps) {
                if (c.isEdge) {
                    const face = c.edgeFace || 'right';
                    if (face === 'right') {
                        c.x = (bx + bw) - c.width * this.metrics.EdgeOverhang;
                    } else if (face === 'left') {
                        c.x = bx - c.width * (1 - this.metrics.EdgeOverhang);
                    } else if (face === 'top') {
                        c.y = by - c.height * (1 - this.metrics.EdgeOverhang);
                    } else if (face === 'bottom') {
                        c.y = (by + bh) - c.height * this.metrics.EdgeOverhang;
                    }
                }
            }

            boards.push({
                id: board.id,
                label: board.label,
                note: board.note,
                x: bx,
                y: by,
                width: bw,
                height: bh,
                componentIds: board.componentIds
            });
        }

        // Adjust external components outside boards
        for (const board of boards) {
            for (const c of components) {
                if (!c.boardId) {
                    if (c.x > board.x) {
                        c.x = Math.max(c.x, board.x + board.width + 180);
                    }
                }
            }
        }

        return boards;
    }

    private assignPorts(
        diagram: WireDiagram,
        components: PlacedComponent[]
    ): void {
        const compMap = new Map(components.map(c => [c.id, c]));

        const compFaceConns = new Map<string, Record<WireFace, Array<{ wireId: string; otherId: string }>>>();
        for (const c of components) {
            compFaceConns.set(c.id, { top: [], bottom: [], left: [], right: [] });
        }

        for (const wire of diagram.wires) {
            if (wire.isBus && wire.busChildren) {
                const sFace = wire.sourceFace || 'bottom';
                compFaceConns.get(wire.sourceId)?.[sFace].push({ wireId: wire.id, otherId: wire.busId || '' });
                for (const ch of wire.busChildren) {
                    compFaceConns.get(ch.targetId)?.['top'].push({ wireId: `${wire.id}_${ch.targetId}`, otherId: wire.sourceId });
                }
            } else {
                const sComp = compMap.get(wire.sourceId);
                const tComp = compMap.get(wire.targetId);
                const { sFace, tFace } = this.inferWireFaces(wire, sComp, tComp);
                compFaceConns.get(wire.sourceId)?.[sFace].push({ wireId: wire.id, otherId: wire.targetId });
                compFaceConns.get(wire.targetId)?.[tFace].push({ wireId: wire.id, otherId: wire.sourceId });
            }
        }

        // Assign ports evenly along each face
        for (const [id, faces] of compFaceConns.entries()) {
            const comp = compMap.get(id);
            if (!comp) continue;

            const topList = faces.top;
            for (let i = 0; i < topList.length; i++) {
                let px: number;
                if (comp.colSpan && comp.colSpan.minCol < comp.colSpan.maxCol) {
                    const other = compMap.get(topList[i].otherId);
                    if (other) {
                        px = other.x + other.width / 2;
                    } else {
                        const busWire = diagram.wires.find(w => w.id === topList[i].wireId && w.isBus);
                        if (busWire && busWire.busChildren && busWire.busChildren.length > 0) {
                            const childComps = busWire.busChildren.map(ch => compMap.get(ch.targetId)).filter(Boolean) as PlacedComponent[];
                            if (childComps.length > 0) {
                                const minChX = Math.min(...childComps.map(c => c.x + c.width / 2));
                                const maxChX = Math.max(...childComps.map(c => c.x + c.width / 2));
                                px = (minChX + maxChX) / 2;
                            } else {
                                px = comp.x + (comp.width * (i + 1)) / (topList.length + 1);
                            }
                        } else {
                            px = comp.x + (comp.width * (i + 1)) / (topList.length + 1);
                        }
                    }
                } else {
                    px = comp.x + (comp.width * (i + 1)) / (topList.length + 1);
                }
                const py = comp.y;
                comp.ports.set(`${topList[i].wireId}_top`, { x: px, y: py, face: 'top' });
            }

            const bottomList = faces.bottom;
            for (let i = 0; i < bottomList.length; i++) {
                let px: number;
                if (comp.colSpan && comp.colSpan.minCol < comp.colSpan.maxCol) {
                    const other = compMap.get(bottomList[i].otherId);
                    if (other) {
                        px = other.x + other.width / 2;
                    } else {
                        const busWire = diagram.wires.find(w => w.id === bottomList[i].wireId && w.isBus);
                        if (busWire && busWire.busChildren && busWire.busChildren.length > 0) {
                            const childComps = busWire.busChildren.map(ch => compMap.get(ch.targetId)).filter(Boolean) as PlacedComponent[];
                            if (childComps.length > 0) {
                                const minChX = Math.min(...childComps.map(c => c.x + c.width / 2));
                                const maxChX = Math.max(...childComps.map(c => c.x + c.width / 2));
                                px = (minChX + maxChX) / 2;
                            } else {
                                px = comp.x + (comp.width * (i + 1)) / (bottomList.length + 1);
                            }
                        } else {
                            px = comp.x + (comp.width * (i + 1)) / (bottomList.length + 1);
                        }
                    }
                } else {
                    px = comp.x + (comp.width * (i + 1)) / (bottomList.length + 1);
                }
                const py = comp.y + comp.height;
                comp.ports.set(`${bottomList[i].wireId}_bottom`, { x: px, y: py, face: 'bottom' });
            }

            const leftList = faces.left;
            for (let i = 0; i < leftList.length; i++) {
                const px = comp.x;
                const py = comp.y + (comp.height * (i + 1)) / (leftList.length + 1);
                comp.ports.set(`${leftList[i].wireId}_left`, { x: px, y: py, face: 'left' });
            }

            const rightList = faces.right;
            for (let i = 0; i < rightList.length; i++) {
                const px = comp.x + comp.width;
                const py = comp.y + (comp.height * (i + 1)) / (rightList.length + 1);
                comp.ports.set(`${rightList[i].wireId}_right`, { x: px, y: py, face: 'right' });
            }
        }
    }

    private routeWiresAndBuses(
        diagram: WireDiagram,
        components: PlacedComponent[],
        boards: PlacedBoard[]
    ): { wires: PlacedWire[]; buses: PlacedBus[] } {
        const compMap = new Map(components.map(c => [c.id, c]));
        const wires: PlacedWire[] = [];
        const buses: PlacedBus[] = [];
        const placedSegments: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number }; isHorizontal: boolean }> = [];

        for (const wire of diagram.wires) {
            if (wire.isBus && wire.busChildren) {
                const srcComp = compMap.get(wire.sourceId);
                if (!srcComp) continue;

                const sFace = wire.sourceFace || 'bottom';
                const sPort = srcComp.ports.get(`${wire.id}_${sFace}`) || {
                    x: srcComp.x + srcComp.width / 2,
                    y: srcComp.y + srcComp.height,
                    face: 'bottom'
                };

                const childPorts: PlacedBusTap[] = [];
                let minChildX = sPort.x;
                let maxChildX = sPort.x;

                // Determine trunkY cleanly between MCU bottom and sensor top
                let sensorTopY = sPort.y + 120;
                for (const ch of wire.busChildren) {
                    const chComp = compMap.get(ch.targetId);
                    if (chComp) {
                        sensorTopY = Math.min(sensorTopY, chComp.y);
                    }
                }
                const trunkY = (sensorTopY - sPort.y >= 120) ? (sPort.y + 75) : (sPort.y + (sensorTopY - sPort.y) * 0.5);

                for (const ch of wire.busChildren) {
                    const chComp = compMap.get(ch.targetId);
                    if (!chComp) continue;
                    const chPort = chComp.ports.get(`${wire.id}_${ch.targetId}_top`) || {
                        x: chComp.x + chComp.width / 2,
                        y: chComp.y,
                        face: 'top'
                    };
                    minChildX = Math.min(minChildX, chPort.x);
                    maxChildX = Math.max(maxChildX, chPort.x);
                    childPorts.push({
                        x: chPort.x,
                        y: chPort.y,
                        targetId: ch.targetId,
                        noteOrAddr: ch.noteOrAddr
                    });
                }

                const trunkStartX = minChildX - 25;
                const trunkEndX = maxChildX + 25;

                buses.push({
                    id: wire.id,
                    busId: wire.busId || 'BUS',
                    protocol: wire.protocol,
                    anchorId: wire.sourceId,
                    anchorFace: sFace,
                    trunkStartX,
                    trunkStartY: trunkY,
                    trunkEndX,
                    trunkEndY: trunkY,
                    tapPoints: childPorts
                });

                placedSegments.push({
                    p1: { x: trunkStartX, y: trunkY },
                    p2: { x: trunkEndX, y: trunkY },
                    isHorizontal: true
                });

                // Path from Anchor to Trunk:
                wires.push({
                    id: wire.id,
                    sourceId: wire.sourceId,
                    targetId: wire.busId || 'BUS',
                    sourceFace: sFace,
                    targetFace: 'top',
                    sourcePoint: { x: sPort.x, y: sPort.y },
                    targetPoint: { x: sPort.x, y: trunkY },
                    arrow: wire.arrow,
                    protocol: wire.protocol,
                    isBus: true,
                    points: [{ x: sPort.x, y: sPort.y }, { x: sPort.x, y: trunkY }],
                    jumpers: [],
                    boundaryConnectors: []
                });

                placedSegments.push({
                    p1: { x: sPort.x, y: sPort.y },
                    p2: { x: sPort.x, y: trunkY },
                    isHorizontal: false
                });

                // Per-child vertical tap wires from trunk to sensor:
                for (const ch of childPorts) {
                    wires.push({
                        id: `${wire.id}_tap_${ch.targetId}`,
                        sourceId: wire.busId || 'BUS',
                        targetId: ch.targetId,
                        sourceFace: 'bottom',
                        targetFace: 'top',
                        sourcePoint: { x: ch.x, y: trunkY },
                        targetPoint: { x: ch.x, y: ch.y },
                        arrow: wire.arrow,
                        isBus: true,
                        note: ch.noteOrAddr,
                        points: [{ x: ch.x, y: trunkY }, { x: ch.x, y: ch.y }],
                        jumpers: [],
                        boundaryConnectors: []
                    });

                    placedSegments.push({
                        p1: { x: ch.x, y: trunkY },
                        p2: { x: ch.x, y: ch.y },
                        isHorizontal: false
                    });
                }
                continue;
            }

            // Regular wire
            const srcComp = compMap.get(wire.sourceId);
            const tgtComp = compMap.get(wire.targetId);
            if (!srcComp || !tgtComp) continue;

            const { sFace, tFace } = this.inferWireFaces(wire, srcComp, tgtComp);

            const sPort = srcComp.ports.get(`${wire.id}_${sFace}`) || {
                x: srcComp.x + (sFace === 'right' ? srcComp.width : 0),
                y: srcComp.y + srcComp.height / 2,
                face: sFace
            };

            const tPort = tgtComp.ports.get(`${wire.id}_${tFace}`) || {
                x: tgtComp.x + (tFace === 'right' ? tgtComp.width : 0),
                y: tgtComp.y + tgtComp.height / 2,
                face: tFace
            };

            const points = this.generateManhattanPoints(sPort, tPort, placedSegments);

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                placedSegments.push({
                    p1,
                    p2,
                    isHorizontal: Math.abs(p1.y - p2.y) < 0.1
                });
            }

            const boundaryConnectors = this.detectBoundaryConnectors(
                points,
                srcComp,
                tgtComp,
                boards,
                wire.connector
            );

            wires.push({
                id: wire.id,
                sourceId: wire.sourceId,
                targetId: wire.targetId,
                sourceFace: sFace,
                targetFace: tFace,
                sourcePoint: { x: sPort.x, y: sPort.y },
                targetPoint: { x: tPort.x, y: tPort.y },
                arrow: wire.arrow,
                protocol: wire.protocol,
                connector: wire.connector,
                note: wire.note,
                isBus: false,
                points,
                jumpers: [],
                boundaryConnectors
            });
        }

        this.calculateJumpers(wires);

        return { wires, buses };
    }

    private generateManhattanPoints(
        sPort: PlacedPort,
        tPort: PlacedPort,
        existingSegments: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number }; isHorizontal: boolean }> = []
    ): Array<{ x: number; y: number }> {
        const sx = sPort.x;
        const sy = sPort.y;
        const tx = tPort.x;
        const ty = tPort.y;

        // Opposing horizontal direct connection: right -> left or left -> right
        if ((sPort.face === 'right' && tPort.face === 'left') || (sPort.face === 'left' && tPort.face === 'right')) {
            if (Math.abs(sy - ty) < 3) {
                return [{ x: sx, y: sy }, { x: tx, y: sy }];
            } else {
                let midX = (sx + tx) / 2;
                midX = this.findFreeVerticalTrack(midX, Math.min(sy, ty), Math.max(sy, ty), existingSegments);
                return [
                    { x: sx, y: sy },
                    { x: midX, y: sy },
                    { x: midX, y: ty },
                    { x: tx, y: ty }
                ];
            }
        }

        // Opposing vertical direct connection: bottom -> top or top -> bottom
        if ((sPort.face === 'bottom' && tPort.face === 'top') || (sPort.face === 'top' && tPort.face === 'bottom')) {
            if (Math.abs(sx - tx) < 3) {
                return [{ x: sx, y: sy }, { x: sx, y: ty }];
            } else {
                // If there is generous vertical clearance (e.g. buses or callouts),
                // place the horizontal segment at 0.65 depth so it doesn't collide with the bus trunk at 0.45..0.5
                let midY = (ty - sy >= 120) ? (sy + (ty - sy) * 0.65) : ((sy + ty) / 2);
                midY = this.findFreeHorizontalTrack(midY, Math.min(sx, tx), Math.max(sx, tx), existingSegments);
                return [
                    { x: sx, y: sy },
                    { x: sx, y: midY },
                    { x: tx, y: midY },
                    { x: tx, y: ty }
                ];
            }
        }

        // Multi-face connection (e.g. right -> top)
        if (sPort.face === 'right' && tPort.face === 'top') {
            return [
                { x: sx, y: sy },
                { x: tx, y: sy },
                { x: tx, y: ty }
            ];
        }

        if (sPort.face === 'bottom' && tPort.face === 'left') {
            return [
                { x: sx, y: sy },
                { x: sx, y: ty },
                { x: tx, y: ty }
            ];
        }

        return [
            { x: sx, y: sy },
            { x: tx, y: sy },
            { x: tx, y: ty }
        ];
    }

    private findFreeHorizontalTrack(
        baseY: number,
        minX: number,
        maxX: number,
        existing: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number }; isHorizontal: boolean }>
    ): number {
        const trackOffsets = [0, 16, -16, 32, -32, 48, -48, 64, -64];
        for (const offset of trackOffsets) {
            const candidateY = baseY + offset;
            const hasOverlap = existing.some(seg => {
                if (!seg.isHorizontal) return false;
                if (Math.abs(seg.p1.y - candidateY) < 6) {
                    const segMinX = Math.min(seg.p1.x, seg.p2.x);
                    const segMaxX = Math.max(seg.p1.x, seg.p2.x);
                    const overlap = Math.min(maxX, segMaxX) - Math.max(minX, segMinX);
                    return overlap > 1;
                }
                return false;
            });
            if (!hasOverlap) {
                return candidateY;
            }
        }
        return baseY;
    }

    private findFreeVerticalTrack(
        baseX: number,
        minY: number,
        maxY: number,
        existing: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number }; isHorizontal: boolean }>
    ): number {
        const trackOffsets = [0, 16, -16, 32, -32, 48, -48, 64, -64];
        for (const offset of trackOffsets) {
            const candidateX = baseX + offset;
            const hasOverlap = existing.some(seg => {
                if (seg.isHorizontal) return false;
                if (Math.abs(seg.p1.x - candidateX) < 6) {
                    const segMinY = Math.min(seg.p1.y, seg.p2.y);
                    const segMaxY = Math.max(seg.p1.y, seg.p2.y);
                    const overlap = Math.min(maxY, segMaxY) - Math.max(minY, segMinY);
                    return overlap > 1;
                }
                return false;
            });
            if (!hasOverlap) {
                return candidateX;
            }
        }
        return baseX;
    }

    private detectBoundaryConnectors(
        points: Array<{ x: number; y: number }>,
        srcComp: PlacedComponent,
        tgtComp: PlacedComponent,
        boards: PlacedBoard[],
        connectorLabel?: string
    ): BoundaryConnector[] {
        const connectors: BoundaryConnector[] = [];

        if (srcComp.boardId === tgtComp.boardId) return connectors;

        // If one of the endpoints is an edge component located on that board,
        // and no explicit connector was specified, the edge component is already the connector.
        const isDirectEdgeConn = !connectorLabel && ((srcComp.isEdge && !!srcComp.boardId) || (tgtComp.isEdge && !!tgtComp.boardId));
        if (isDirectEdgeConn) return connectors;

        for (const board of boards) {
            if (board.id === srcComp.boardId || board.id === tgtComp.boardId) {
                const bx1 = board.x;
                const by1 = board.y;
                const bx2 = board.x + board.width;
                const by2 = board.y + board.height;

                for (let i = 0; i < points.length - 1; i++) {
                    const p1 = points[i];
                    const p2 = points[i + 1];

                    if (Math.abs(p1.y - p2.y) < 0.1) {
                        const y = p1.y;
                        if (y >= by1 && y <= by2) {
                            const minX = Math.min(p1.x, p2.x);
                            const maxX = Math.max(p1.x, p2.x);
                            if (minX <= bx2 && maxX >= bx2) {
                                connectors.push({
                                    x: bx2,
                                    y,
                                    label: connectorLabel || 'CN',
                                    face: 'right'
                                });
                            }
                            if (minX <= bx1 && maxX >= bx1) {
                                connectors.push({
                                    x: bx1,
                                    y,
                                    label: connectorLabel || 'CN',
                                    face: 'left'
                                });
                            }
                        }
                    }

                    if (Math.abs(p1.x - p2.x) < 0.1) {
                        const x = p1.x;
                        if (x >= bx1 && x <= bx2) {
                            const minY = Math.min(p1.y, p2.y);
                            const maxY = Math.max(p1.y, p2.y);
                            if (minY <= by1 && maxY >= by1) {
                                connectors.push({
                                    x,
                                    y: by1,
                                    label: connectorLabel || 'CN',
                                    face: 'top'
                                });
                            }
                            if (minY <= by2 && maxY >= by2) {
                                connectors.push({
                                    x,
                                    y: by2,
                                    label: connectorLabel || 'CN',
                                    face: 'bottom'
                                });
                            }
                        }
                    }
                }
            }
        }

        return connectors;
    }

    private calculateJumpers(wires: PlacedWire[]): void {
        interface HSeg {
            wireId: string;
            x1: number;
            x2: number;
            y: number;
        }
        const hSegments: HSeg[] = [];

        for (const w of wires) {
            for (let i = 0; i < w.points.length - 1; i++) {
                const p1 = w.points[i];
                const p2 = w.points[i + 1];
                if (Math.abs(p1.y - p2.y) < 0.1) {
                    hSegments.push({
                        wireId: w.id,
                        x1: Math.min(p1.x, p2.x),
                        x2: Math.max(p1.x, p2.x),
                        y: p1.y
                    });
                }
            }
        }

        for (const w of wires) {
            for (let i = 0; i < w.points.length - 1; i++) {
                const p1 = w.points[i];
                const p2 = w.points[i + 1];
                if (Math.abs(p1.x - p2.x) < 0.1) {
                    const vx = p1.x;
                    const vy1 = Math.min(p1.y, p2.y);
                    const vy2 = Math.max(p1.y, p2.y);

                    for (const h of hSegments) {
                        if (h.wireId !== w.id) {
                            if (h.x1 + 4 < vx && vx < h.x2 - 4 && vy1 + 4 < h.y && h.y < vy2 - 4) {
                                w.jumpers.push({
                                    x: vx,
                                    y: h.y,
                                    radius: this.metrics.JumperRadius
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    private placeCallouts(
        diagram: WireDiagram,
        components: PlacedComponent[]
    ): PlacedCallout[] {
        const callouts: PlacedCallout[] = [];
        const compMap = new Map(components.map(c => [c.id, c]));

        for (const c of diagram.callouts) {
            const target = compMap.get(c.targetId);
            if (!target) continue;

            const textLen = c.text.length;
            const width = Math.min(280, Math.max(130, textLen * 9 + 30));
            const height = 30;

            let cx = target.x;
            let cy = target.y;
            let tx = target.x + target.width / 2;
            let ty = target.y;

            if (c.targetFace === 'bottom') {
                // Place callout in the upper band under MCU, slightly to the left
                cx = target.x + 10;
                cy = target.y + target.height + 15;
                tx = target.x + 30;
                ty = target.y + target.height;
            } else if (c.targetFace === 'top') {
                cx = target.x + (target.width - width) / 2;
                cy = target.y - height - 25;
                tx = target.x + target.width / 2;
                ty = target.y;
            } else if (c.targetFace === 'left') {
                cx = target.x - width - 25;
                cy = target.y + (target.height - height) / 2;
                tx = target.x;
                ty = target.y + target.height / 2;
            } else if (c.targetFace === 'right') {
                cx = target.x + target.width + 25;
                cy = target.y + (target.height - height) / 2;
                tx = target.x + target.width;
                ty = target.y + target.height / 2;
            } else {
                cx = target.x + target.width + 15;
                cy = target.y - 15;
                tx = target.x + target.width;
                ty = target.y;
            }

            callouts.push({
                id: c.id,
                type: c.type,
                x: cx,
                y: cy,
                width,
                height,
                text: c.text,
                targetPoint: { x: tx, y: ty },
                targetId: c.targetId
            });
        }

        return callouts;
    }

    private inferWireFaces(
        wire: WireConnection,
        sComp?: { gridCol: number; gridRow: number },
        tComp?: { gridCol: number; gridRow: number }
    ): { sFace: WireFace; tFace: WireFace } {
        let sFace = wire.sourceFace;
        let tFace = wire.targetFace;

        if (sComp && tComp) {
            if (sFace === 'bottom' && !tFace) {
                tFace = 'top';
            } else if (sFace === 'top' && !tFace) {
                tFace = 'bottom';
            } else if (tFace === 'top' && !sFace) {
                sFace = 'bottom';
            } else if (tFace === 'bottom' && !sFace) {
                sFace = 'top';
            } else if (sFace === 'right' && !tFace) {
                tFace = 'left';
            } else if (sFace === 'left' && !tFace) {
                tFace = 'right';
            } else if (tFace === 'left' && !sFace) {
                sFace = 'right';
            } else if (tFace === 'right' && !sFace) {
                sFace = 'left';
            }
        }

        if (!sFace || !tFace) {
            if (sComp && tComp) {
                if (sComp.gridCol === tComp.gridCol) {
                    if (tComp.gridRow > sComp.gridRow) {
                        sFace = sFace || 'bottom';
                        tFace = tFace || 'top';
                    } else if (tComp.gridRow < sComp.gridRow) {
                        sFace = sFace || 'top';
                        tFace = tFace || 'bottom';
                    }
                } else if (sComp.gridRow === tComp.gridRow) {
                    if (tComp.gridCol > sComp.gridCol) {
                        sFace = sFace || 'right';
                        tFace = tFace || 'left';
                    } else {
                        sFace = sFace || 'left';
                        tFace = tFace || 'right';
                    }
                } else {
                    if (tComp.gridRow > sComp.gridRow) {
                        sFace = sFace || 'bottom';
                        tFace = tFace || 'top';
                    } else if (tComp.gridRow < sComp.gridRow) {
                        sFace = sFace || 'top';
                        tFace = tFace || 'bottom';
                    }
                }
            }
        }

        return {
            sFace: sFace || 'right',
            tFace: tFace || 'left'
        };
    }
}
