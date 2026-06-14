import {
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

export function estimateTextWidth(text: string, fontSize: number = 12): number {
    if (!text) return 0;
    const cleanText = text
        .replace(/<[^>]+>/g, '')
        .replace(/~~|__|\*\*|\/\/|""|--/g, '');
    
    const iconMatches = text.match(/<&[a-zA-Z0-9_-]+>/g) || [];
    const numIcons = iconMatches.length;
    const cleanTextWithoutIcons = cleanText.replace(/<&[a-zA-Z0-9_-]+>/g, '');
    
    return cleanTextWithoutIcons.length * (fontSize * 0.58) + numIcons * 18;
}

export function estimateTextHeight(text: string, fontSize: number = 12): number {
    if (!text) return fontSize + 4;
    const lines = text.split('\n');
    return lines.length * (fontSize * 1.3) + 4;
}

export function measureWidget(widget: Widget, sprites: Map<string, string[]>): void {
    const fontSize = 12;

    switch (widget.type) {
        case 'label': {
            const w = widget as LabelWidget;
            if (w.text === '*') {
                w.width = 0;
                w.height = 0;
            } else if (w.text === '.') {
                w.width = 0;
                w.height = 0;
            } else {
                w.width = estimateTextWidth(w.text, fontSize);
                w.height = estimateTextHeight(w.text, fontSize);
            }
            break;
        }
        case 'button': {
            const w = widget as ButtonWidget;
            w.width = estimateTextWidth(w.label, fontSize) + 16;
            w.height = Math.max(24, estimateTextHeight(w.label, fontSize) + 8);
            break;
        }
        case 'checkbox': {
            const w = widget as CheckboxWidget;
            w.width = 16 + 6 + estimateTextWidth(w.label, fontSize);
            w.height = Math.max(18, estimateTextHeight(w.label, fontSize) + 4);
            break;
        }
        case 'radio': {
            const w = widget as RadioWidget;
            w.width = 16 + 6 + estimateTextWidth(w.label, fontSize);
            w.height = Math.max(18, estimateTextHeight(w.label, fontSize) + 4);
            break;
        }
        case 'input': {
            const w = widget as InputWidget;
            w.width = estimateTextWidth(w.label, fontSize) + 16;
            w.height = Math.max(24, estimateTextHeight(w.label, fontSize) + 8);
            break;
        }
        case 'droplist': {
            const w = widget as DroplistWidget;
            w.width = estimateTextWidth(w.label, fontSize) + 28;
            w.height = Math.max(24, estimateTextHeight(w.label, fontSize) + 8);
            break;
        }
        case 'separator': {
            const w = widget as SeparatorWidget;
            w.width = w.title ? estimateTextWidth(w.title, 11) + 24 : 40;
            w.height = w.title ? Math.max(16, estimateTextHeight(w.title, 11) + 4) : 10;
            break;
        }
        case 'sprite': {
            const w = widget as SpriteRefWidget;
            const lines = sprites.get(w.name);
            if (lines && lines.length > 0) {
                const pixelSize = 1.5;
                w.height = lines.length * pixelSize;
                w.width = Math.max(...lines.map(l => l.length)) * pixelSize;
            } else {
                w.width = 16;
                w.height = 16;
            }
            break;
        }
        case 'grid': {
            const w = widget as GridWidget;
            const rows = w.rows;
            const R = rows.length;
            if (R === 0) {
                w.width = 20;
                w.height = 20;
                break;
            }

            let maxCols = 0;
            for (let r = 0; r < R; r++) {
                maxCols = Math.max(maxCols, rows[r].length);
                for (let c = 0; c < rows[r].length; c++) {
                    if (rows[r][c]) {
                        measureWidget(rows[r][c], sprites);
                    }
                }
            }

            const colWidths = new Array(maxCols).fill(0);
            const rowHeights = new Array(R).fill(0);

            for (let r = 0; r < R; r++) {
                // Check if this row is a separator spanning all columns
                const isSeparatorRow = rows[r].length === 1 && rows[r][0].type === 'separator';

                for (let c = 0; c < rows[r].length; c++) {
                    const child = rows[r][c];
                    if (!child) continue;

                    // Row height is max of all child heights in this row
                    rowHeights[r] = Math.max(rowHeights[r], child.height || 0);

                    // Col width is max of child widths in this column (skip separators/span indicators)
                    if (!isSeparatorRow && child.type !== 'separator') {
                        if (child.type === 'label' && ((child as LabelWidget).text === '*' || (child as LabelWidget).text === '.')) {
                            // span-left / empty cell contributions are 0
                        } else {
                            colWidths[c] = Math.max(colWidths[c], child.width || 0);
                        }
                    }
                }
            }

            const padding = 6;
            const gapX = 12;
            const gapY = 8;

            w.width = padding * 2 + colWidths.reduce((a, b) => a + b, 0) + Math.max(0, colWidths.length - 1) * gapX;
            w.height = padding * 2 + rowHeights.reduce((a, b) => a + b, 0) + Math.max(0, R - 1) * gapY;
            break;
        }
        case 'groupbox': {
            const w = widget as GroupBoxWidget;
            measureWidget(w.content, sprites);
            
            const paddingHorizontal = 16;
            const paddingVertical = 24;
            
            const titleWidth = estimateTextWidth(w.title, 11) + 24;
            w.width = Math.max(titleWidth, (w.content.width || 0) + paddingHorizontal);
            w.height = (w.content.height || 0) + paddingVertical;
            break;
        }
        case 'tabs': {
            const w = widget as TabWidget;
            const padding = 10;
            const gap = 8;
            
            if (w.vertical) {
                let maxWidth = 0;
                let totalHeight = 0;
                w.tabs.forEach(tab => {
                    maxWidth = Math.max(maxWidth, estimateTextWidth(tab, fontSize) + 16);
                    totalHeight += Math.max(20, estimateTextHeight(tab, fontSize) + 6);
                });
                w.width = maxWidth;
                w.height = totalHeight + padding * 2;
            } else {
                let totalWidth = 0;
                let maxHeight = 0;
                w.tabs.forEach(tab => {
                    totalWidth += estimateTextWidth(tab, fontSize) + 16 + gap;
                    maxHeight = Math.max(maxHeight, estimateTextHeight(tab, fontSize) + 6);
                });
                w.width = totalWidth + padding * 2;
                w.height = maxHeight + 8;
            }
            break;
        }
        case 'menu': {
            const w = widget as MenuWidget;
            const fontSizeMenu = 12;
            let totalWidth = 16;
            w.items.forEach(item => {
                totalWidth += estimateTextWidth(item, fontSizeMenu) + 16;
            });
            w.width = totalWidth;
            w.height = 24;
            break;
        }
        case 'tree': {
            const w = widget as TreeWidget;
            const nodes = w.nodes;
            const N = nodes.length;
            if (N === 0) {
                w.width = 20;
                w.height = 20;
                break;
            }

            let maxCols = 0;
            nodes.forEach(node => {
                maxCols = Math.max(maxCols, node.cells.length);
                node.cells.forEach(cell => {
                    measureWidget(cell, sprites);
                });
            });

            const colWidths = new Array(maxCols).fill(0);
            const rowHeights = new Array(N).fill(0);

            for (let n = 0; n < N; n++) {
                const node = nodes[n];
                const indentation = (node.level - 1) * 16;
                
                for (let c = 0; c < node.cells.length; c++) {
                    const cell = node.cells[c];
                    if (!cell) continue;

                    rowHeights[n] = Math.max(rowHeights[n], cell.height || 0);

                    if (c === 0) {
                        const cellWidth = indentation + 20 + (cell.width || 0);
                        colWidths[0] = Math.max(colWidths[0], cellWidth);
                    } else {
                        colWidths[c] = Math.max(colWidths[c], cell.width || 0);
                    }
                }
            }

            const padding = 8;
            const gapX = 12;
            const gapY = 6;

            w.width = padding * 2 + colWidths.reduce((a, b) => a + b, 0) + Math.max(0, colWidths.length - 1) * gapX;
            w.height = padding * 2 + rowHeights.reduce((a, b) => a + b, 0) + Math.max(0, N - 1) * gapY;
            break;
        }
        case 'scroll': {
            const w = widget as ScrollWidget;
            measureWidget(w.content, sprites);
            
            w.width = (w.content.width || 0) + (w.vertical ? 12 : 0);
            w.height = (w.content.height || 0) + (w.horizontal ? 12 : 0);
            break;
        }
    }
}

export function layoutWidget(
    widget: Widget,
    x: number,
    y: number,
    width: number,
    height: number,
    sprites: Map<string, string[]>
): void {
    widget.x = x;
    widget.y = y;
    widget.width = width;
    widget.height = height;

    switch (widget.type) {
        case 'grid': {
            const w = widget as GridWidget;
            const rows = w.rows;
            const R = rows.length;
            if (R === 0) break;

            let maxCols = 0;
            for (let r = 0; r < R; r++) {
                maxCols = Math.max(maxCols, rows[r].length);
            }

            const colWidths = new Array(maxCols).fill(0);
            const rowHeights = new Array(R).fill(0);

            // Recompute widths and heights based on measured values to maintain alignment
            for (let r = 0; r < R; r++) {
                const isSeparatorRow = rows[r].length === 1 && rows[r][0].type === 'separator';
                for (let c = 0; c < rows[r].length; c++) {
                    const child = rows[r][c];
                    if (!child) continue;

                    rowHeights[r] = Math.max(rowHeights[r], child.height || 0);
                    if (!isSeparatorRow && child.type !== 'separator') {
                        if (child.type === 'label' && ((child as LabelWidget).text === '*' || (child as LabelWidget).text === '.')) {
                            // no width contribution
                        } else {
                            colWidths[c] = Math.max(colWidths[c], child.width || 0);
                        }
                    }
                }
            }

            // Distribute extra space if width/height is larger than measured
            const padding = 6;
            const gapX = 12;
            const gapY = 8;

            const measuredWidth = padding * 2 + colWidths.reduce((a, b) => a + b, 0) + Math.max(0, colWidths.length - 1) * gapX;
            if (width > measuredWidth && colWidths.length > 0) {
                const extraX = (width - measuredWidth) / colWidths.length;
                for (let c = 0; c < colWidths.length; c++) {
                    colWidths[c] += extraX;
                }
            }

            const measuredHeight = padding * 2 + rowHeights.reduce((a, b) => a + b, 0) + Math.max(0, R - 1) * gapY;
            if (height > measuredHeight && R > 0) {
                const extraY = (height - measuredHeight) / R;
                for (let r = 0; r < R; r++) {
                    rowHeights[r] += extraY;
                }
            }

            // Lay out cell widgets
            let currentY = y + padding;
            for (let r = 0; r < R; r++) {
                let currentX = x + padding;
                const isSeparatorRow = rows[r].length === 1 && rows[r][0].type === 'separator';

                if (isSeparatorRow) {
                    const child = rows[r][0];
                    const fullWidth = width - padding * 2;
                    layoutWidget(child, currentX, currentY, fullWidth, rowHeights[r], sprites);
                } else {
                    for (let c = 0; c < rows[r].length; c++) {
                        const child = rows[r][c];
                        if (!child) {
                            currentX += colWidths[c] + gapX;
                            continue;
                        }

                        // Check for column span (*)
                        let spanCount = 1;
                        while (
                            c + spanCount < rows[r].length &&
                            rows[r][c + spanCount] &&
                            rows[r][c + spanCount].type === 'label' &&
                            (rows[r][c + spanCount] as LabelWidget).text === '*'
                        ) {
                            spanCount++;
                        }

                        const cellWidth = colWidths.slice(c, c + spanCount).reduce((a, b) => a + b, 0) + (spanCount - 1) * gapX;
                        const cellHeight = rowHeights[r];

                        layoutWidget(child, currentX, currentY, cellWidth, cellHeight, sprites);

                        currentX += cellWidth + gapX;
                        c += spanCount - 1; // skip spanned cells
                    }
                }
                currentY += rowHeights[r] + gapY;
            }
            break;
        }
        case 'groupbox': {
            const w = widget as GroupBoxWidget;
            const paddingHorizontal = 16;
            const paddingVertical = 24;

            const contentWidth = width - paddingHorizontal;
            const contentHeight = height - paddingVertical;

            layoutWidget(w.content, x + 8, y + 16, contentWidth, contentHeight, sprites);
            break;
        }
        case 'tabs': {
            // Tab bar layout (subcomponents of TabWidget are handled when rendering)
            break;
        }
        case 'menu': {
            // Menu bar layout
            break;
        }
        case 'tree': {
            const w = widget as TreeWidget;
            const nodes = w.nodes;
            const N = nodes.length;
            if (N === 0) break;

            let maxCols = 0;
            nodes.forEach(node => {
                maxCols = Math.max(maxCols, node.cells.length);
            });

            const colWidths = new Array(maxCols).fill(0);
            const rowHeights = new Array(N).fill(0);

            for (let n = 0; n < N; n++) {
                const node = nodes[n];
                const indentation = (node.level - 1) * 16;
                for (let c = 0; c < node.cells.length; c++) {
                    const cell = node.cells[c];
                    if (!cell) continue;

                    rowHeights[n] = Math.max(rowHeights[n], cell.height || 0);
                    if (c === 0) {
                        colWidths[0] = Math.max(colWidths[0], indentation + 20 + (cell.width || 0));
                    } else {
                        colWidths[c] = Math.max(colWidths[c], cell.width || 0);
                    }
                }
            }

            const padding = 8;
            const gapX = 12;
            const gapY = 6;

            let currentY = y + padding;
            for (let n = 0; n < N; n++) {
                const node = nodes[n];
                const indentation = (node.level - 1) * 16;
                
                // Lay out first cell with indentation
                if (node.cells[0]) {
                    const firstCellX = x + padding + indentation + 20;
                    const firstCellWidth = colWidths[0] - indentation - 20;
                    layoutWidget(node.cells[0], firstCellX, currentY, firstCellWidth, rowHeights[n], sprites);
                }

                // Lay out subsequent cells
                let currentX = x + padding + colWidths[0] + gapX;
                for (let c = 1; c < node.cells.length; c++) {
                    const cell = node.cells[c];
                    if (cell) {
                        layoutWidget(cell, currentX, currentY, colWidths[c], rowHeights[n], sprites);
                    }
                    currentX += colWidths[c] + gapX;
                }

                currentY += rowHeights[n] + gapY;
            }
            break;
        }
        case 'scroll': {
            const w = widget as ScrollWidget;
            const contentWidth = width - (w.vertical ? 12 : 0);
            const contentHeight = height - (w.horizontal ? 12 : 0);

            layoutWidget(w.content, x, y, contentWidth, contentHeight, sprites);
            break;
        }
    }
}
