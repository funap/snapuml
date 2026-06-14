import { Renderer } from '../../core/Renderer';
import {
    SaltDiagram,
    Widget,
    GridWidget,
    GroupBoxWidget,
    TabWidget,
    MenuWidget,
    TreeWidget,
    ScrollWidget,
    ButtonWidget,
    CheckboxWidget,
    RadioWidget,
    InputWidget,
    DroplistWidget,
    SeparatorWidget,
    SpriteRefWidget,
    LabelWidget
} from './SaltDiagram';
import { estimateTextWidth, estimateTextHeight, measureWidget, layoutWidget } from './SaltLayout';

export function formatSaltRichText(text: string): string {
    if (!text) return '';

    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<tspan font-weight="bold">$1</tspan>');
    escaped = escaped.replace(/\/\/(.*?)\/\//g, '<tspan font-style="italic">$1</tspan>');
    escaped = escaped.replace(/&quot;&quot;(.*?)&quot;&quot;/g, '<tspan font-family="monospace">$1</tspan>');
    escaped = escaped.replace(/__(.*?)__/g, '<tspan text-decoration="underline">$1</tspan>');
    escaped = escaped.replace(/~~(.*?)~~/g, '<tspan style="text-decoration: underline; text-decoration-style: wavy">$1</tspan>');
    
    escaped = escaped.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<tspan font-weight="bold">$1</tspan>');
    escaped = escaped.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<tspan text-decoration="underline">$1</tspan>');
    escaped = escaped.replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, '<tspan font-style="italic">$1</tspan>');
    escaped = escaped.replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/gi, '<tspan text-decoration="line-through">$1</tspan>');
    
    escaped = escaped.replace(/&lt;s:([a-zA-Z0-9#]+)&gt;(.*?)&lt;\/s&gt;/gi, '<tspan text-decoration="line-through" style="text-decoration-color: $1">$2</tspan>');
    escaped = escaped.replace(/&lt;u:([a-zA-Z0-9#]+)&gt;(.*?)&lt;\/u&gt;/gi, '<tspan text-decoration="underline" style="text-decoration-color: $1">$2</tspan>');
    escaped = escaped.replace(/&lt;w:([a-zA-Z0-9#]+)&gt;(.*?)&lt;\/w&gt;/gi, '<tspan style="text-decoration: underline; text-decoration-style: wavy; text-decoration-color: $1">$2</tspan>');
    
    escaped = escaped.replace(/&lt;color:([a-zA-Z0-9#]+)&gt;(.*?)&lt;\/color&gt;/gi, '<tspan fill="$1">$2</tspan>');
    escaped = escaped.replace(/&lt;color:([a-zA-Z0-9#]+)&gt;(.*)/gi, '<tspan fill="$1">$2</tspan>');
    
    escaped = escaped.replace(/&lt;back:([a-zA-Z0-9#]+)&gt;(.*?)&lt;\/back&gt;/gi, '<tspan style="background-color: $1">$2</tspan>');

    escaped = escaped.replace(/&lt;size:(\d+)&gt;(.*?)&lt;\/size&gt;/gi, '<tspan font-size="$1">$2</tspan>');
    escaped = escaped.replace(/&lt;size:(\d+)&gt;(.*)/gi, '<tspan font-size="$1">$2</tspan>');

    escaped = escaped.replace(/&lt;font:monospaced&gt;(.*?)&lt;\/font&gt;/gi, '<tspan font-family="monospace">$1</tspan>');

    return escaped;
}

function getIconSvgPath(name: string): string {
    switch (name.toLowerCase()) {
        case 'person':
            return `
                <circle cx="7" cy="4.5" r="2.5" />
                <path d="M 2,12.5 C 2,9.5 4.5,8.5 7,8.5 C 9.5,8.5 12,9.5 12,12.5 Z" />
            `.trim();
        case 'key':
            return `
                <circle cx="4.5" cy="7.5" r="2.5" fill="none" stroke-width="1.5" />
                <path d="M 7,7.5 L 13.5,7.5 L 13.5,9.5 L 12,9.5 L 12,7.5 L 10.5,7.5 L 10.5,9.5 L 9,9.5 L 9,7.5" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            `.trim();
        case 'circle-x':
            return `
                <circle cx="7" cy="7" r="6" fill="none" stroke-width="1.5" />
                <path d="M 4,4 L 10,10 M 10,4 L 4,10" stroke-width="1.5" stroke-linecap="round" />
            `.trim();
        case 'account-login':
            return `
                <path d="M 2.5,2 L 11.5,2 L 11.5,5 L 10,5 L 10,3.5 L 4,3.5 L 4,11.5 L 10,11.5 L 10,10 L 11.5,10 L 11.5,13 L 2.5,13 Z" fill-rule="evenodd" />
                <path d="M 7,5 L 10.5,7.5 L 7,10 L 7,8.5 L 5,8.5 L 5,6.5 L 7,6.5 Z" fill-rule="evenodd" />
            `.trim();
        case 'clock':
            return `
                <circle cx="7" cy="7" r="6" fill="none" stroke-width="1.5" />
                <path d="M 7,3 L 7,7 L 10,7" stroke-width="1.5" stroke-linecap="round" fill="none" />
            `.trim();
        default:
            return `
                <polygon points="7,1 9,5 13.5,5.5 10,9 11,13.5 7,11 3,13.5 4,9 0.5,5.5 5,5" stroke-width="1" />
            `.trim();
    }
}

function renderTextWithIcons(
    text: string,
    x: number,
    y: number,
    color: string,
    fontFamily: string,
    fontSize: number,
    align: 'left' | 'center' = 'left',
    height: number = 18
): string {
    const regex = /<&([a-zA-Z0-9_-]+)>/g;
    const parts: { type: 'text' | 'icon'; value: string }[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', value: text.substring(lastIndex, match.index) });
        }
        parts.push({ type: 'icon', value: match[1] });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.substring(lastIndex) });
    }

    if (parts.length === 0) return '';

    let totalWidth = 0;
    parts.forEach(p => {
        if (p.type === 'text') {
            totalWidth += estimateTextWidth(p.value, fontSize);
        } else {
            totalWidth += 18;
        }
    });

    let currentX = x;
    if (align === 'center') {
        currentX = x - totalWidth / 2;
    }

    const yOffsetText = y + (height - fontSize) / 2 + fontSize - 2;
    const yOffsetIcon = y + (height - 14) / 2;

    let svg = '';
    parts.forEach(p => {
        if (p.type === 'text') {
            const formatted = formatSaltRichText(p.value);
            svg += `<text x="${currentX}" y="${yOffsetText}" fill="${color}" font-family="${fontFamily}" font-size="${fontSize}">${formatted}</text>`;
            currentX += estimateTextWidth(p.value, fontSize);
        } else {
            svg += `<g transform="translate(${currentX}, ${yOffsetIcon})" stroke="${color}" fill="${color}">${getIconSvgPath(p.value)}</g>`;
            currentX += 18;
        }
    });

    return svg;
}

export class SaltRenderer implements Renderer {
    private fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    private handwritten = false;
    private overlays: string[] = [];

    render(diagram: SaltDiagram): string {
        this.overlays = [];
        this.handwritten = diagram.handwritten;
        if (this.handwritten) {
            this.fontFamily = "'Comic Sans MS', 'Caveat', cursive, sans-serif";
        } else {
            this.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
        }

        // Measure all sizes
        if (diagram.root) {
            measureWidget(diagram.root, diagram.sprites);
            layoutWidget(diagram.root, 10, 10 + this.getHeaderHeight(diagram), diagram.root.width || 0, diagram.root.height || 0, diagram.sprites);
        }

        const headerHeight = this.getHeaderHeight(diagram);
        const rootWidth = diagram.root?.width || 100;
        const rootHeight = diagram.root?.height || 100;

        const legendHeight = diagram.legend ? 40 : 0;
        const captionHeight = diagram.caption ? 20 : 0;
        const footerHeight = diagram.footer ? 20 : 0;

        const canvasWidth = rootWidth + 20;
        const canvasHeight = rootHeight + 20 + headerHeight + legendHeight + captionHeight + footerHeight;

        let scaleFactor = diagram.scale || 1;
        if (diagram.dpi) {
            scaleFactor = diagram.dpi / 96;
        }

        const widthAttr = canvasWidth * scaleFactor;
        const heightAttr = canvasHeight * scaleFactor;

        let svg = `<svg width="${widthAttr}" height="${heightAttr}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg" style="background: ${diagram.backgroundColor || '#ffffff'}; font-family: ${this.fontFamily};">\n`;

        // Shadow definitions for premium aesthetics
        svg += `  <defs>\n`;
        svg += `    <filter id="subtle-shadow" x="-5%" y="-5%" width="110%" height="115%">\n`;
        svg += `      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.06" />\n`;
        svg += `    </filter>\n`;
        svg += `    <filter id="dropdown-shadow" x="-10%" y="-10%" width="120%" height="125%">\n`;
        svg += `      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.1" />\n`;
        svg += `    </filter>\n`;
        svg += `  </defs>\n`;

        // Render header details
        let currentY = 10;
        if (diagram.header) {
            svg += `  <text x="10" y="${currentY + 12}" fill="#6b7280" font-size="11" font-weight="bold">${diagram.header}</text>\n`;
            currentY += 20;
        }
        if (diagram.title) {
            svg += `  <text x="${canvasWidth / 2}" y="${currentY + 16}" fill="#111827" font-size="16" font-weight="bold" text-anchor="middle">${diagram.title}</text>\n`;
            currentY += 28;
        }

        // Render root widget tree
        if (diagram.root) {
            svg += this.renderWidget(diagram.root, diagram);
        }

        // Render footer details
        currentY = canvasHeight - 10;
        if (diagram.footer) {
            svg += `  <text x="10" y="${currentY - 4}" fill="#6b7280" font-size="11" font-weight="bold">${diagram.footer}</text>\n`;
            currentY -= 20;
        }
        if (diagram.caption) {
            svg += `  <text x="${canvasWidth / 2}" y="${currentY - 4}" fill="#4b5563" font-size="12" text-anchor="middle">${diagram.caption}</text>\n`;
            currentY -= 20;
        }
        if (diagram.legend) {
            const legendW = estimateTextWidth(diagram.legend, 11) + 20;
            svg += `  <g transform="translate(${canvasWidth - legendW - 10}, ${currentY - 35})">\n`;
            svg += `    <rect width="${legendW}" height="30" rx="3" fill="#f9fafb" stroke="#d1d5db" stroke-width="1" />\n`;
            svg += `    <text x="${legendW / 2}" y="18" fill="#4b5563" font-size="11" text-anchor="middle">${diagram.legend}</text>\n`;
            svg += `  </g>\n`;
        }

        if (this.overlays.length > 0) {
            svg += `  <!-- Dropdowns and overlays rendered on top -->\n`;
            svg += this.overlays.join('\n');
        }

        svg += `</svg>`;
        return svg;
    }

    private getHeaderHeight(diagram: SaltDiagram): number {
        let h = 0;
        if (diagram.header) h += 20;
        if (diagram.title) h += 28;
        return h;
    }

    private renderWidget(widget: Widget, diagram: SaltDiagram): string {
        const sprites = diagram.sprites;
        const x = widget.x || 0;
        const y = widget.y || 0;
        const w = widget.width || 0;
        const h = widget.height || 0;

        let svg = '';

        switch (widget.type) {
            case 'label': {
                const label = widget as LabelWidget;
                if (label.text === '*' || label.text === '.') break;
                svg += renderTextWithIcons(label.text, x + 2, y, '#1f2937', this.fontFamily, 12, 'left', h);
                break;
            }
            case 'button': {
                const btn = widget as ButtonWidget;
                svg += `  <g filter="url(#subtle-shadow)">\n`;
                svg += `    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ry="4" fill="url(#btn-grad)" stroke="#d1d5db" stroke-width="1.2" />\n`;
                svg += `  </g>\n`;
                svg += `  <defs>\n`;
                svg += `    <linearGradient id="btn-grad" x1="0" y1="0" x2="0" y2="1">\n`;
                svg += `      <stop offset="0%" stop-color="#ffffff" />\n`;
                svg += `      <stop offset="100%" stop-color="#f3f4f6" />\n`;
                svg += `    </linearGradient>\n`;
                svg += `  </defs>\n`;
                svg += renderTextWithIcons(btn.label, x + w / 2, y, '#1f2937', this.fontFamily, 12, 'center', h);
                break;
            }
            case 'checkbox': {
                const cb = widget as CheckboxWidget;
                const boxY = y + (h - 14) / 2;
                svg += `  <rect x="${x}" y="${boxY}" width="14" height="14" rx="2" ry="2" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5" />\n`;
                if (cb.checked) {
                    svg += `  <path d="M ${x + 3.5},${boxY + 7} L ${x + 6},${boxY + 9.5} L ${x + 10.5},${boxY + 3.5}" stroke="#2563eb" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />\n`;
                }
                svg += renderTextWithIcons(cb.label, x + 20, y, '#1f2937', this.fontFamily, 12, 'left', h);
                break;
            }
            case 'radio': {
                const rd = widget as RadioWidget;
                const circleY = y + (h - 14) / 2 + 7;
                svg += `  <circle cx="${x + 7}" cy="${circleY}" r="7" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5" />\n`;
                if (rd.checked) {
                    svg += `  <circle cx="${x + 7}" cy="${circleY}" r="3.5" fill="#2563eb" />\n`;
                }
                svg += renderTextWithIcons(rd.label, x + 20, y, '#1f2937', this.fontFamily, 12, 'left', h);
                break;
            }
            case 'input': {
                const inp = widget as InputWidget;
                svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" ry="3" fill="#ffffff" stroke="#d1d5db" stroke-width="1.2" />\n`;
                svg += renderTextWithIcons(inp.label, x + 8, y, '#374151', this.fontFamily, 12, 'left', h);
                break;
            }
            case 'droplist': {
                const dl = widget as DroplistWidget;
                svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" ry="3" fill="#ffffff" stroke="#d1d5db" stroke-width="1.2" />\n`;
                svg += `  <path d="M ${x + w - 16},${y + h / 2 - 2} L ${x + w - 10},${y + h / 2 + 3} L ${x + w - 4},${y + h / 2 - 2}" stroke="#4b5563" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />\n`;
                svg += renderTextWithIcons(dl.label, x + 8, y, '#1f2937', this.fontFamily, 12, 'left', h);

                if (dl.open && dl.items && dl.items.length > 0) {
                    const itemH = 20;
                    const ddH = dl.items.length * itemH + 8;
                    let ddSvg = '';
                    ddSvg += `  <g filter="url(#dropdown-shadow)">\n`;
                    ddSvg += `    <rect x="${x}" y="${y + h}" width="${w}" height="${ddH}" rx="4" ry="4" fill="#ffffff" stroke="#d1d5db" stroke-width="1" />\n`;
                    ddSvg += `  </g>\n`;
                    
                    dl.items.forEach((item, idx) => {
                        const itemY = y + h + 4 + idx * itemH;
                        // Draw highlight for the first item as hovered
                        if (idx === 0) {
                            ddSvg += `    <rect x="${x + 2}" y="${itemY}" width="${w - 4}" height="${itemH}" fill="#eff6ff" rx="2" />\n`;
                        }
                        ddSvg += renderTextWithIcons(item, x + 8, itemY, '#1f2937', this.fontFamily, 12, 'left', itemH);
                    });
                    this.overlays.push(ddSvg);
                }
                break;
            }
            case 'separator': {
                const sep = widget as SeparatorWidget;
                const lineY = y + h / 2;
                let strokeDash = '';
                let strokeW = 1.2;
                
                if (sep.style === 'dotted') strokeDash = 'stroke-dasharray="3,3"';
                else if (sep.style === 'strong') strokeW = 2.2;
                
                if (sep.style === 'double') {
                    svg += `  <line x1="${x}" y1="${lineY - 1.5}" x2="${x + w}" y2="${lineY - 1.5}" stroke="#9ca3af" stroke-width="1" />\n`;
                    svg += `  <line x1="${x}" y1="${lineY + 1.5}" x2="${x + w}" y2="${lineY + 1.5}" stroke="#9ca3af" stroke-width="1" />\n`;
                } else {
                    svg += `  <line x1="${x}" y1="${lineY}" x2="${x + w}" y2="${lineY}" stroke="#9ca3af" stroke-width="${strokeW}" ${strokeDash} />\n`;
                }

                if (sep.title) {
                    const textW = estimateTextWidth(sep.title, 11);
                    const textX = x + (w - textW) / 2;
                    svg += `  <rect x="${textX - 4}" y="${lineY - 8}" width="${textW + 8}" height="16" fill="${this.handwritten ? 'none' : '#ffffff'}" />\n`;
                    svg += `  <text x="${x + w / 2}" y="${lineY + 4}" fill="#4b5563" font-size="11" font-weight="bold" text-anchor="middle">${sep.title}</text>\n`;
                }
                break;
            }
            case 'sprite': {
                const sp = widget as SpriteRefWidget;
                const lines = sprites.get(sp.name);
                if (lines && lines.length > 0) {
                    const pixelSize = 1.5;
                    svg += `  <g transform="translate(${x}, ${y})">\n`;
                    lines.forEach((line, r) => {
                        for (let c = 0; c < line.length; c++) {
                            const char = line[c];
                            if (char !== '.') {
                                svg += `    <rect x="${c * pixelSize}" y="${r * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#4b5563" />\n`;
                            }
                        }
                    });
                    svg += `  </g>\n`;
                } else {
                    // Render default folder icon if not found
                    svg += `  <g transform="translate(${x}, ${y + (h - 14) / 2})" stroke="#4b5563" stroke-width="1.5" fill="none" stroke-linejoin="round">\n`;
                    svg += `    <path d="M 1.5,12 C 1.5,12 1.5,2 1.5,2 L 5.5,2 L 7.5,4.5 L 12.5,4.5 L 12.5,12 Z" />\n`;
                    svg += `  </g>\n`;
                }
                break;
            }
            case 'grid': {
                const grid = widget as GridWidget;
                
                // Draw grid lines
                const rows = grid.rows;
                const R = rows.length;
                
                // 1. External lines
                if (grid.lineStyle === 'all' || grid.lineStyle === 'external') {
                    svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ry="4" fill="none" stroke="#d1d5db" stroke-width="1.2" />\n`;
                }

                // Render children
                for (let r = 0; r < rows.length; r++) {
                    for (let c = 0; c < rows[r].length; c++) {
                        const child = rows[r][c];
                        if (child) {
                            svg += this.renderWidget(child, diagram);
                        }
                    }
                }

                // 2. Internal lines
                if (grid.lineStyle === 'all' || grid.lineStyle === 'vertical' || grid.lineStyle === 'horizontal') {
                    // Draw horizontal dividers between rows
                    if (grid.lineStyle === 'all' || grid.lineStyle === 'horizontal') {
                        const uniqueYSet = new Set<number>();
                        for (let r = 0; r < rows.length - 1; r++) {
                            if (rows[r][0]) {
                                uniqueYSet.add((rows[r][0].y || 0) + (rows[r][0].height || 0) + 4);
                            }
                        }
                        uniqueYSet.forEach(dividerY => {
                            svg += `  <line x1="${x + 6}" y1="${dividerY}" x2="${x + w - 6}" y2="${dividerY}" stroke="#e5e7eb" stroke-width="1" />\n`;
                        });
                    }
                    
                    // Draw vertical dividers between columns
                    if (grid.lineStyle === 'all' || grid.lineStyle === 'vertical') {
                        const uniqueXSet = new Set<number>();
                        for (let r = 0; r < rows.length; r++) {
                            for (let c = 0; c < rows[r].length - 1; c++) {
                                const child = rows[r][c];
                                if (child) {
                                    uniqueXSet.add((child.x || 0) + (child.width || 0) + 6);
                                }
                            }
                        }
                        uniqueXSet.forEach(dividerX => {
                            svg += `  <line x1="${dividerX}" y1="${y + 6}" x2="${dividerX}" y2="${y + h - 6}" stroke="#e5e7eb" stroke-width="1" />\n`;
                        });
                    }
                }
                break;
            }
            case 'groupbox': {
                const gb = widget as GroupBoxWidget;
                svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ry="4" fill="none" stroke="#d1d5db" stroke-width="1.2" />\n`;
                
                const titleW = estimateTextWidth(gb.title, 11);
                svg += `  <rect x="${x + 8}" y="${y - 8}" width="${titleW + 8}" height="16" fill="${diagram.backgroundColor || '#ffffff'}" />\n`;
                svg += `  <text x="${x + 12}" y="${y + 4}" fill="#374151" font-size="11" font-weight="bold">${gb.title}</text>\n`;

                svg += this.renderWidget(gb.content, diagram);
                break;
            }
            case 'tabs': {
                const tabs = widget as TabWidget;
                const fontSizeTabs = 12;
                const padding = 10;
                const gap = 8;

                if (tabs.vertical) {
                    let currentItemY = y + padding;
                    tabs.tabs.forEach((tab, idx) => {
                        const itemH = 22;
                        const isSelected = idx === tabs.activeIndex;
                        
                        if (isSelected) {
                            svg += `  <rect x="${x}" y="${currentItemY}" width="${w}" height="${itemH}" fill="#ffffff" stroke="#d1d5db" stroke-width="1" />\n`;
                            svg += `  <line x1="${x + w}" y1="${currentItemY + 0.5}" x2="${x + w}" y2="${currentItemY + itemH - 0.5}" stroke="#ffffff" stroke-width="1.5" />\n`;
                            svg += renderTextWithIcons(tab, x + 8, currentItemY, '#2563eb', this.fontFamily, fontSizeTabs, 'left', itemH);
                        } else {
                            svg += `  <rect x="${x}" y="${currentItemY}" width="${w - 2}" height="${itemH}" fill="#f3f4f6" stroke="#d1d5db" stroke-width="1" />\n`;
                            svg += renderTextWithIcons(tab, x + 6, currentItemY, '#4b5563', this.fontFamily, fontSizeTabs, 'left', itemH);
                        }
                        currentItemY += itemH + 4;
                    });
                } else {
                    let currentItemX = x + padding;
                    tabs.tabs.forEach((tab, idx) => {
                        const tabW = estimateTextWidth(tab, fontSizeTabs) + 16;
                        const itemH = h - 2;
                        const isSelected = idx === tabs.activeIndex;
                        
                        if (isSelected) {
                            svg += `  <rect x="${currentItemX}" y="${y}" width="${tabW}" height="${itemH}" fill="#ffffff" stroke="#d1d5db" stroke-width="1" />\n`;
                            svg += `  <line x1="${currentItemX + 0.5}" y1="${y + itemH}" x2="${currentItemX + tabW - 0.5}" y2="${y + itemH}" stroke="#ffffff" stroke-width="1.5" />\n`;
                            svg += renderTextWithIcons(tab, currentItemX + tabW / 2, y, '#2563eb', this.fontFamily, fontSizeTabs, 'center', itemH);
                        } else {
                            svg += `  <rect x="${currentItemX}" y="${y + 2}" width="${tabW}" height="${itemH - 2}" fill="#f3f4f6" stroke="#d1d5db" stroke-width="1" />\n`;
                            svg += renderTextWithIcons(tab, currentItemX + tabW / 2, y + 2, '#4b5563', this.fontFamily, fontSizeTabs, 'center', itemH - 2);
                        }
                        currentItemX += tabW + gap;
                    });
                }
                break;
            }
            case 'menu': {
                const menu = widget as MenuWidget;
                const fontSizeMenu = 12;
                
                // Draw menu bar background
                svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f3f4f6" rx="3" ry="3" stroke="#e5e7eb" stroke-width="0.8" />\n`;
                
                let currentItemX = x + 8;
                menu.items.forEach((item, idx) => {
                    const itemW = estimateTextWidth(item, fontSizeMenu) + 16;
                    const isOpen = idx === menu.openIndex;
                    
                    if (isOpen) {
                        svg += `  <rect x="${currentItemX}" y="${y + 2}" width="${itemW}" height="${h - 4}" fill="#ffffff" rx="2" stroke="#d1d5db" stroke-width="0.8" />\n`;
                        svg += renderTextWithIcons(item, currentItemX + itemW / 2, y, '#2563eb', this.fontFamily, fontSizeMenu, 'center', h);
                        
                        // Render open dropdown menu
                        if (menu.dropdownItems && menu.dropdownItems.length > 0) {
                            const ddItemH = 20;
                            let ddW = 120;
                            menu.dropdownItems.forEach(ddItem => {
                                ddW = Math.max(ddW, estimateTextWidth(ddItem, fontSizeMenu) + 32);
                            });
                            
                            const ddH = menu.dropdownItems.length * ddItemH + 8;
                            const ddX = currentItemX;
                            const ddY = y + h;
                            
                            let ddSvg = '';
                            ddSvg += `  <g filter="url(#dropdown-shadow)">\n`;
                            ddSvg += `    <rect x="${ddX}" y="${ddY}" width="${ddW}" height="${ddH}" rx="4" ry="4" fill="#ffffff" stroke="#d1d5db" stroke-width="1" />\n`;
                            ddSvg += `  </g>\n`;
                            
                            menu.dropdownItems.forEach((ddItem, ddIdx) => {
                                const ddItemY = ddY + 4 + ddIdx * ddItemH;
                                if (ddItem === '-') {
                                    ddSvg += `    <line x1="${ddX + 4}" y1="${ddItemY + ddItemH / 2}" x2="${ddX + ddW - 4}" y2="${ddItemY + ddItemH / 2}" stroke="#e5e7eb" stroke-width="1" />\n`;
                                } else {
                                    ddSvg += renderTextWithIcons(ddItem, ddX + 12, ddItemY, '#374151', this.fontFamily, fontSizeMenu, 'left', ddItemH);
                                }
                            });
                            this.overlays.push(ddSvg);
                        }
                    } else {
                        svg += renderTextWithIcons(item, currentItemX + itemW / 2, y, '#374151', this.fontFamily, fontSizeMenu, 'center', h);
                    }
                    currentItemX += itemW;
                });
                break;
            }
            case 'tree': {
                const tree = widget as TreeWidget;
                const nodes = tree.nodes;
                const N = nodes.length;

                // Draw tree container background / border if tree lineStyle is used
                if (tree.lineStyle === 'all' || tree.lineStyle === 'external') {
                    svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ry="4" fill="none" stroke="#d1d5db" stroke-width="1.2" />\n`;
                }

                // Render tree node lines and expand/collapse icons
                for (let n = 0; n < N; n++) {
                    const node = nodes[n];
                    const indentation = (node.level - 1) * 16;
                    const nodeY = node.cells[0]?.y || y;
                    const nodeH = node.cells[0]?.height || 18;
                    const lineX = x + 8 + indentation;
                    const centerY = nodeY + nodeH / 2;

                    // Draw vertical guide line to parent if level > 1
                    if (node.level > 1) {
                        // Find preceding node of lower level to connect to
                        let parentY = y + 8;
                        for (let prev = n - 1; prev >= 0; prev--) {
                            if (nodes[prev].level < node.level) {
                                parentY = (nodes[prev].cells[0]?.y || y) + (nodes[prev].cells[0]?.height || 18) / 2;
                                break;
                            }
                        }
                        svg += `  <line x1="${lineX - 8}" y1="${parentY}" x2="${lineX - 8}" y2="${centerY}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="2,2" />\n`;
                        svg += `  <line x1="${lineX - 8}" y1="${centerY}" x2="${lineX}" y2="${centerY}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="2,2" />\n`;
                    }

                    // Check if node has children to draw collapse/expand box
                    const hasChildren = n + 1 < N && nodes[n + 1].level > node.level;
                    if (hasChildren) {
                        svg += `  <rect x="${lineX - 4}" y="${centerY - 4}" width="8" height="8" fill="#ffffff" stroke="#6b7280" stroke-width="1" />\n`;
                        svg += `  <line x1="${lineX - 2}" y1="${centerY}" x2="${lineX + 2}" y2="${centerY}" stroke="#374151" stroke-width="1" />\n`;
                        // Draw plus if collapsed (always draw minus for expanded since we render all nodes)
                    }

                    // Render node cells
                    node.cells.forEach(cell => {
                        svg += this.renderWidget(cell, diagram);
                    });
                }

                // Draw tree table grid lines
                if (tree.lineStyle === 'all' || tree.lineStyle === 'vertical' || tree.lineStyle === 'horizontal') {
                    // Horizontal dividers
                    if (tree.lineStyle === 'all' || tree.lineStyle === 'horizontal') {
                        for (let n = 0; n < N - 1; n++) {
                            const node = nodes[n];
                            if (node.cells[0]) {
                                const divY = (node.cells[0].y || 0) + (node.cells[0].height || 0) + 3;
                                svg += `  <line x1="${x + 6}" y1="${divY}" x2="${x + w - 6}" y2="${divY}" stroke="#e5e7eb" stroke-width="1" />\n`;
                            }
                        }
                    }

                    // Vertical dividers
                    if (tree.lineStyle === 'all' || tree.lineStyle === 'vertical') {
                        const uniqueXSet = new Set<number>();
                        for (let n = 0; n < N; n++) {
                            for (let c = 0; c < nodes[n].cells.length - 1; c++) {
                                const child = nodes[n].cells[c];
                                if (child) {
                                    uniqueXSet.add((child.x || 0) + (child.width || 0) + 6);
                                }
                            }
                        }
                        uniqueXSet.forEach(dividerX => {
                            svg += `  <line x1="${dividerX}" y1="${y + 6}" x2="${dividerX}" y2="${y + h - 6}" stroke="#e5e7eb" stroke-width="1" />\n`;
                        });
                    }
                }
                break;
            }
            case 'scroll': {
                const scr = widget as ScrollWidget;
                svg += this.renderWidget(scr.content, diagram);

                // Render vertical scrollbar
                if (scr.vertical) {
                    const sbX = x + w - 12;
                    svg += `  <rect x="${sbX}" y="${y}" width="12" height="${h}" fill="#f3f4f6" stroke="#e5e7eb" stroke-width="0.8" />\n`;
                    svg += `  <rect x="${sbX + 2}" y="${y + 14}" width="8" height="${h - 28}" rx="4" ry="4" fill="#d1d5db" />\n`;
                    // Up arrow
                    svg += `  <path d="M ${sbX + 6},${y + 4} L ${sbX + 3},${y + 8} L ${sbX + 9},${y + 8} Z" fill="#4b5563" />\n`;
                    // Down arrow
                    svg += `  <path d="M ${sbX + 6},${y + h - 4} L ${sbX + 3},${y + h - 8} L ${sbX + 9},${y + h - 8} Z" fill="#4b5563" />\n`;
                }

                // Render horizontal scrollbar
                if (scr.horizontal) {
                    const sbY = y + h - 12;
                    svg += `  <rect x="${x}" y="${sbY}" width="${w}" height="12" fill="#f3f4f6" stroke="#e5e7eb" stroke-width="0.8" />\n`;
                    svg += `  <rect x="${x + 14}" y="${sbY + 2}" width="${w - 28}" height="8" rx="4" ry="4" fill="#d1d5db" />\n`;
                    // Left arrow
                    svg += `  <path d="M ${x + 4},${sbY + 6} L ${x + 8},${sbY + 3} L ${x + 8},${sbY + 9} Z" fill="#4b5563" />\n`;
                    // Right arrow
                    svg += `  <path d="M ${x + w - 4},${sbY + 6} L ${x + w - 8},${sbY + 3} L ${x + w - 8},${sbY + 9} Z" fill="#4b5563" />\n`;
                }
                break;
            }
        }

        return svg;
    }
}
