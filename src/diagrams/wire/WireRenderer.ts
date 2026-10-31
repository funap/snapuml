import { Renderer } from '../../core/Renderer';
import { getTextWidth } from '../../core/RichText';
import { WireDiagram } from './WireDiagram';
import {
    WireLayout,
    WireLayoutResult,
    PlacedComponent,
    PlacedBoard,
    PlacedBus,
    PlacedWire,
    PlacedCallout,
    BoundaryConnector
} from './WireLayout';

export class WireRenderer implements Renderer<WireDiagram> {
    private layoutEngine: WireLayout;

    constructor(layoutEngine: WireLayout = new WireLayout()) {
        this.layoutEngine = layoutEngine;
    }

    render(diagram: WireDiagram): string {
        const layout = this.layoutEngine.layout(diagram);
        return this.renderSVG(layout);
    }

    private renderSVG(layout: WireLayoutResult): string {
        const width = layout.width;
        const height = layout.height;

        const defs = this.renderDefs();
        const boardsSvg = layout.boards.map(b => this.renderBoard(b)).join('\n');
        const wiresSvg = layout.wires.map(w => this.renderWire(w)).join('\n');
        const busesSvg = layout.buses.map(b => this.renderBus(b)).join('\n');
        const componentsSvg = layout.components.map(c => this.renderComponent(c)).join('\n');
        const connectorsSvg = this.renderBoundaryConnectors(layout.wires);
        const calloutsSvg = layout.callouts.map(c => this.renderCallout(c)).join('\n');
        const labelsSvg = layout.wires.map(w => this.renderWireLabel(w, this.getWireColor(w))).filter(Boolean).join('\n');

        return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    ${defs}
    <g class="wire-boards">
        ${boardsSvg}
    </g>
    <g class="wire-wires">
        ${wiresSvg}
    </g>
    <g class="wire-buses">
        ${busesSvg}
    </g>
    <g class="wire-components">
        ${componentsSvg}
    </g>
    <g class="wire-boundary-connectors">
        ${connectorsSvg}
    </g>
    <g class="wire-callouts">
        ${calloutsSvg}
    </g>
    <g class="wire-labels">
        ${labelsSvg}
    </g>
</svg>`.trim();
    }

    private renderDefs(): string {
        return `
    <defs>
        <!-- Generic arrow markers -->
        <marker id="arrow-end-default" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 1 L 7 4 L 0 7 Z" fill="#334155" />
        </marker>
        <marker id="arrow-start-default" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
            <path d="M 7 1 L 0 4 L 7 7 Z" fill="#334155" />
        </marker>

        <!-- Power arrow markers -->
        <marker id="arrow-end-power" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M 0 1 L 8 4.5 L 0 8 Z" fill="#DC2626" />
        </marker>
        <marker id="arrow-start-power" markerWidth="9" markerHeight="9" refX="1" refY="4.5" orient="auto">
            <path d="M 8 1 L 0 4.5 L 8 8 Z" fill="#DC2626" />
        </marker>

        <!-- SPI arrow markers -->
        <marker id="arrow-end-spi" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 1 L 7 4 L 0 7 Z" fill="#2563EB" />
        </marker>
        <marker id="arrow-start-spi" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
            <path d="M 7 1 L 0 4 L 7 7 Z" fill="#2563EB" />
        </marker>

        <!-- I2C arrow markers -->
        <marker id="arrow-end-i2c" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 1 L 7 4 L 0 7 Z" fill="#16A34A" />
        </marker>
        <marker id="arrow-start-i2c" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
            <path d="M 7 1 L 0 4 L 7 7 Z" fill="#16A34A" />
        </marker>

        <!-- UART arrow markers -->
        <marker id="arrow-end-uart" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 1 L 7 4 L 0 7 Z" fill="#9333EA" />
        </marker>
        <marker id="arrow-start-uart" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
            <path d="M 7 1 L 0 4 L 7 7 Z" fill="#9333EA" />
        </marker>

        <!-- DIFF arrow markers -->
        <marker id="arrow-end-diff" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 1 L 7 4 L 0 7 Z" fill="#0D9488" />
        </marker>
        <marker id="arrow-start-diff" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
            <path d="M 7 1 L 0 4 L 7 7 Z" fill="#0D9488" />
        </marker>
    </defs>`;
    }

    private renderBoard(board: PlacedBoard): string {
        const titleText = this.escapeXml(board.label);
        const noteText = board.note ? this.escapeXml(board.note) : '';
        const titleWidth = Math.max(90, Math.ceil(getTextWidth(board.label, 12)) + 16);

        return `
        <g class="board" id="board-${board.id}">
            <rect x="${board.x}" y="${board.y}" width="${board.width}" height="${board.height}" rx="10" ry="10" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2" stroke-dasharray="6,4" />
            <rect x="${board.x + 14}" y="${board.y + 24}" width="${titleWidth}" height="22" rx="4" ry="4" fill="#E2E8F0" />
            <text x="${board.x + 22}" y="${board.y + 39}" font-size="12" font-weight="bold" fill="#1E293B">${titleText}</text>
            ${noteText ? `<text x="${board.x + 26 + titleWidth}" y="${board.y + 39}" font-size="11" fill="#64748B">${noteText}</text>` : ''}
        </g>`;
    }

    private renderComponent(comp: PlacedComponent): string {
        const fill = comp.color || '#FFFFFF';
        const stroke = comp.isEdge ? '#0284C7' : '#334155';
        const hasNote = Boolean(comp.note);
        const hasSubLabel = Boolean(comp.label && comp.label !== comp.id);

        const labelLines = hasSubLabel ? comp.label.split(/\\n|\n/) : [];
        const noteLines = hasNote ? (comp.note || '').split(/\\n|\n/) : [];

        let titleY = comp.y + (comp.height / 2);
        if (hasSubLabel && hasNote) {
            titleY = comp.y + 20;
        } else if (hasSubLabel) {
            titleY = comp.y + (comp.height / 2) - (labelLines.length * 15) / 2 + 4;
        } else if (hasNote) {
            titleY = comp.y + (comp.height / 2) - (noteLines.length * 14) / 2 - 2;
        }

        const subLabelSvg = labelLines.map((line, idx) => {
            return `<text x="${comp.x + comp.width / 2}" y="${titleY + 16 + idx * 15}" text-anchor="middle" font-size="11" fill="#475569">${this.escapeXml(line)}</text>`;
        }).join('\n');

        const noteSvg = noteLines.map((line, idx) => {
            const noteStartY = comp.y + comp.height - 10 - (noteLines.length - 1 - idx) * 14;
            return `<text x="${comp.x + comp.width / 2}" y="${noteStartY}" text-anchor="middle" font-size="10" font-style="italic" fill="#64748B">${this.escapeXml(line)}</text>`;
        }).join('\n');

        return `
        <g class="component" id="comp-${comp.id}">
            <rect x="${comp.x}" y="${comp.y}" width="${comp.width}" height="${comp.height}" rx="6" ry="6" fill="${fill}" stroke="${stroke}" stroke-width="${comp.isEdge ? 2 : 1.8}" />
            <text x="${comp.x + comp.width / 2}" y="${titleY}" text-anchor="middle" font-size="13" font-weight="bold" fill="#0F172A">${this.escapeXml(comp.id)}</text>
            ${subLabelSvg}
            ${noteSvg}
        </g>`;
    }

    private renderBus(bus: PlacedBus): string {
        const busColor = '#1E40AF';
        const busWidth = 4;

        const trunkLine = `<line x1="${bus.trunkStartX}" y1="${bus.trunkStartY}" x2="${bus.trunkEndX}" y2="${bus.trunkEndY}" stroke="${busColor}" stroke-width="${busWidth}" stroke-linecap="round" />`;

        const hasCustomBusId = bus.busId && bus.busId !== 'BUS';
        let labelText = '';
        if (hasCustomBusId) {
            labelText = this.escapeXml(bus.busId) + (bus.protocol ? ` : ${this.escapeXml(bus.protocol.raw)}` : '');
        } else if (bus.protocol) {
            labelText = this.escapeXml(bus.protocol.raw);
        } else {
            labelText = this.escapeXml(bus.busId);
        }

        const label = labelText ? `<text x="${bus.trunkStartX}" y="${bus.trunkStartY - 8}" font-size="11" font-weight="bold" fill="${busColor}">${labelText}</text>` : '';

        const dots = bus.tapPoints.map(tap => {
            return `<circle cx="${tap.x}" cy="${tap.y}" r="4" fill="${busColor}" />`;
        }).join('\n');

        return `
        <g class="bus-trunk" id="bus-${bus.id}">
            ${trunkLine}
            ${label}
            ${dots}
        </g>`;
    }

    private getWireColor(wire: PlacedWire): string {
        const protoName = wire.protocol?.name?.toLowerCase() || '';
        if (protoName === 'power') {
            return '#DC2626';
        } else if (protoName === 'spi') {
            return '#2563EB';
        } else if (protoName === 'i2c') {
            return '#16A34A';
        } else if (protoName === 'uart') {
            return '#9333EA';
        } else if (protoName === 'diff') {
            return '#0D9488';
        } else if (protoName === 'gpio') {
            return '#475569';
        }
        return '#334155';
    }

    private renderWire(wire: PlacedWire): string {
        if (wire.points.length < 2) return '';

        const protoName = wire.protocol?.name?.toLowerCase() || '';
        const strokeColor = this.getWireColor(wire);
        let strokeWidth = 1.5;
        let markerSuffix = 'default';

        if (protoName === 'power') {
            strokeWidth = 2.8;
            markerSuffix = 'power';
        } else if (protoName === 'spi') {
            strokeWidth = 1.8;
            markerSuffix = 'spi';
        } else if (protoName === 'i2c') {
            strokeWidth = 1.8;
            markerSuffix = 'i2c';
        } else if (protoName === 'uart') {
            strokeWidth = 1.8;
            markerSuffix = 'uart';
        } else if (protoName === 'diff') {
            strokeWidth = 2.0;
            markerSuffix = 'diff';
        } else if (protoName === 'gpio') {
            strokeWidth = 1.8;
            markerSuffix = 'default';
        }

        let markerStartAttr = '';
        let markerEndAttr = '';

        if (wire.arrow.direction === 'forward' || wire.arrow.direction === 'bidirectional') {
            markerEndAttr = `marker-end="url(#arrow-end-${markerSuffix})"`;
        }
        if (wire.arrow.direction === 'backward' || wire.arrow.direction === 'bidirectional') {
            markerStartAttr = `marker-start="url(#arrow-start-${markerSuffix})"`;
        }

        // Build SVG path data with Jumper bridges on vertical segments
        const pathData = this.buildPathWithJumpers(wire.points, wire.jumpers);

        let linesSvg = `<path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" ${markerStartAttr} ${markerEndAttr} />`;

        // If diff pair: draw twin parallel line
        if (protoName === 'diff') {
            linesSvg += `\n<path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="3,3" opacity="0.7" transform="translate(0, 3)" />`;
        }

        return `
        <g class="wire" id="${wire.id}">
            ${linesSvg}
        </g>`;
    }

    private buildPathWithJumpers(points: Array<{ x: number; y: number }>, jumpers: Array<{ x: number; y: number; radius: number }>): string {
        if (points.length < 2) return '';

        let d = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Check if vertical segment
            if (Math.abs(p1.x - p2.x) < 0.1) {
                const vx = p1.x;
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);
                const isGoingDown = p2.y > p1.y;

                // Find jumpers on this vertical segment
                const segJumpers = jumpers.filter(j => Math.abs(j.x - vx) < 0.1 && j.y > minY && j.y < maxY);

                if (segJumpers.length === 0) {
                    d += ` L ${p2.x} ${p2.y}`;
                } else {
                    // Sort jumpers in traversal direction
                    segJumpers.sort((a, b) => isGoingDown ? a.y - b.y : b.y - a.y);

                    for (const j of segJumpers) {
                        const r = j.radius;
                        if (isGoingDown) {
                            d += ` L ${vx} ${j.y - r}`;
                            // Semi-circle jumper hopping to the right
                            d += ` A ${r} ${r} 0 0 1 ${vx} ${j.y + r}`;
                        } else {
                            d += ` L ${vx} ${j.y + r}`;
                            d += ` A ${r} ${r} 0 0 1 ${vx} ${j.y - r}`;
                        }
                    }
                    d += ` L ${p2.x} ${p2.y}`;
                }
            } else {
                // Horizontal line (stays straight: "水平線を地（直線）")
                d += ` L ${p2.x} ${p2.y}`;
            }
        }

        return d;
    }

    private renderWireLabel(wire: PlacedWire, color: string): string {
        // Do not render protocol badge on the short vertical bus feed line; trunk already displays it
        if (wire.isBus && !wire.note) return '';

        const textItems: string[] = [];
        if (wire.protocol) {
            textItems.push(wire.protocol.raw);
        }
        if (wire.note) {
            textItems.push(wire.note);
        }

        if (textItems.length === 0) return '';

        const rawText = textItems.join(' ');
        const lines = rawText.split(/\\n|\n/);
        const textW = Math.max(...lines.map(l => getTextWidth(l, 10)));
        const width = Math.max(20, Math.ceil(textW) + 14);
        const height = lines.length === 1 ? 18 : 10 + lines.length * 13;

        let midX: number;
        let midY: number;

        // If wire crosses a board boundary, place label clearly outside or inside away from connector
        if (wire.boundaryConnectors.length > 0) {
            const bc = wire.boundaryConnectors[0];
            const lastPt = wire.points[wire.points.length - 1];
            const bcBadgeW = Math.max(20, Math.ceil(getTextWidth(bc.label || 'CN', 10)) + 14);
            // If going rightwards from border
            if (lastPt.x > bc.x) {
                midX = Math.max(bc.x + bcBadgeW + width / 2 + 15, bc.x + (lastPt.x - bc.x) * 0.55);
                midY = bc.y;
            } else if (lastPt.x < bc.x) {
                midX = Math.min(bc.x - bcBadgeW - width / 2 - 15, lastPt.x + (bc.x - lastPt.x) * 0.45);
                midY = bc.y;
            } else {
                midX = bc.x + 40;
                midY = bc.y;
            }
        } else {
            // Find longest segment to host the label
            let longestIdx = 0;
            let maxLen = 0;
            for (let i = 0; i < wire.points.length - 1; i++) {
                const pA = wire.points[i];
                const pB = wire.points[i + 1];
                const len = Math.hypot(pB.x - pA.x, pB.y - pA.y);
                if (len > maxLen) {
                    maxLen = len;
                    longestIdx = i;
                }
            }

            const p1 = wire.points[longestIdx];
            const p2 = wire.points[longestIdx + 1];

            if (wire.isBus && wire.targetFace === 'top') {
                // Bus tap label: place just above the child component
                midX = p2.x;
                midY = p2.y - 12;
            } else if (wire.sourceFace === 'bottom' && wire.targetFace === 'top') {
                // Direct wire under bottom: place label towards target to avoid crossing vertical taps
                midX = p1.x + (p2.x - p1.x) * 0.72;
                midY = (p1.y + p2.y) / 2;
            } else {
                midX = (p1.x + p2.x) / 2;
                midY = (p1.y + p2.y) / 2;
            }
        }

        let textSvg: string;
        if (lines.length === 1) {
            textSvg = `<text x="${midX}" y="${midY - height / 2 - 1}" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">${this.escapeXml(lines[0])}</text>`;
        } else {
            const startY = (midY - height - 4) + 12;
            const tspans = lines.map((l, i) => `<tspan x="${midX}" dy="${i === 0 ? 0 : 13}">${this.escapeXml(l)}</tspan>`).join('');
            textSvg = `<text x="${midX}" y="${startY}" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">${tspans}</text>`;
        }

        return `
        <g class="wire-label" id="label-${wire.id}">
            <rect x="${midX - width / 2}" y="${midY - height - 4}" width="${width}" height="${height}" rx="3" ry="3" fill="#FFFFFF" stroke="${color}" stroke-width="0.8" />
            ${textSvg}
        </g>`;
    }

    private renderBoundaryConnectors(wires: PlacedWire[]): string {
        const svgParts: string[] = [];

        for (const w of wires) {
            for (const bc of w.boundaryConnectors) {
                const labelText = this.escapeXml(bc.label || 'CN');
                const isVerticalBorder = bc.face === 'right' || bc.face === 'left';

                const rectWidth = isVerticalBorder ? 12 : 24;
                const rectHeight = isVerticalBorder ? 24 : 12;

                const rx = bc.x - rectWidth / 2;
                const ry = bc.y - rectHeight / 2;

                const badgeW = Math.max(24, Math.ceil(getTextWidth(bc.label || 'CN', 10)) + 14);
                const badgeX = isVerticalBorder ? (bc.face === 'right' ? bc.x + 8 : bc.x - badgeW - 8) : bc.x - badgeW / 2;
                const badgeY = isVerticalBorder ? bc.y - 10 : (bc.face === 'bottom' ? bc.y + 8 : bc.y - 24);

                svgParts.push(`
                <g class="boundary-connector">
                    <rect x="${rx}" y="${ry}" width="${rectWidth}" height="${rectHeight}" rx="2" ry="2" fill="#FEF3C7" stroke="#B45309" stroke-width="1.5" />
                    <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="18" rx="3" ry="3" fill="#FFFBEB" stroke="#D97706" stroke-width="1" />
                    <text x="${badgeX + badgeW / 2}" y="${badgeY + 13}" font-size="10" font-weight="bold" fill="#92400E" text-anchor="middle">${labelText}</text>
                </g>`);
            }
        }

        return svgParts.join('\n');
    }

    private renderCallout(callout: PlacedCallout): string {
        const isWarning = callout.type === 'warning';
        const bg = isWarning ? '#FEF3C7' : '#EFF6FF';
        const stroke = isWarning ? '#F59E0B' : '#60A5FA';
        const textFill = isWarning ? '#B45309' : '#1E40AF';
        const icon = isWarning ? '⚠️ ' : 'ℹ️ ';

        // Leader line connects from closest edge of callout box to targetPoint
        const tx = callout.targetPoint.x;
        const ty = callout.targetPoint.y;

        let lx: number;
        let ly: number;

        if (callout.y + callout.height <= ty + 2) {
            // Callout is above target point
            ly = callout.y + callout.height;
            lx = Math.max(callout.x + 10, Math.min(callout.x + callout.width - 10, tx));
        } else if (callout.y >= ty - 2) {
            // Callout is below target point
            ly = callout.y;
            lx = Math.max(callout.x + 10, Math.min(callout.x + callout.width - 10, tx));
        } else if (callout.x >= tx) {
            // Callout is to the right of target point
            lx = callout.x;
            ly = Math.max(callout.y + 6, Math.min(callout.y + callout.height - 6, ty));
        } else {
            // Callout is to the left of target point
            lx = callout.x + callout.width;
            ly = Math.max(callout.y + 6, Math.min(callout.y + callout.height - 6, ty));
        }

        const leaderLine = `
        <line x1="${lx}" y1="${ly}" x2="${tx}" y2="${ty}" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="3,3" />
        <circle cx="${tx}" cy="${ty}" r="2.5" fill="#64748B" />`;

        const lines = callout.text.split(/\\n|\n/);
        let textSvg: string;
        if (lines.length === 1) {
            textSvg = `<text x="${callout.x + 8}" y="${callout.y + 20}" font-size="11" font-weight="bold" fill="${textFill}">${icon}${this.escapeXml(lines[0])}</text>`;
        } else {
            const startY = Math.round((callout.height - (lines.length - 1) * 16) / 2 + 4);
            const tspans = lines.map((line, idx) => {
                const x = idx === 0 ? callout.x + 8 : callout.x + 8 + 22;
                const dy = idx === 0 ? 0 : 16;
                const prefix = idx === 0 ? icon : '';
                return `<tspan x="${x}" dy="${dy}">${prefix}${this.escapeXml(line)}</tspan>`;
            }).join('');
            textSvg = `<text x="${callout.x + 8}" y="${callout.y + startY}" font-size="11" font-weight="bold" fill="${textFill}">${tspans}</text>`;
        }

        return `
        <g class="callout" id="${callout.id}">
            ${leaderLine}
            <rect x="${callout.x}" y="${callout.y}" width="${callout.width}" height="${callout.height}" rx="4" ry="4" fill="${bg}" stroke="${stroke}" stroke-width="1.4" />
            ${textSvg}
        </g>`;
    }

    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
