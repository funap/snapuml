import { Parser } from '../../core/Parser';
import {
    SaltDiagram,
    Widget,
    GridWidget,
    TreeWidget,
    TabWidget,
    MenuWidget,
    ScrollWidget,
    TreeNode,
    LineStyle
} from './SaltDiagram';

export function preprocessSalt(content: string, diagram: SaltDiagram): string {
    const lines = content.split('\n');
    const bodyLines: string[] = [];
    
    let inStyle = false;
    let inLegend = false;
    let legendLines: string[] = [];
    let inSprite = false;
    let spriteName = '';
    let spriteLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const rawLine = lines[i];

        if (line === '') continue;

        // Skip start/end tags
        if (/@startsalt/i.test(line) || /@endsalt/i.test(line) || /\{\{salt/i.test(line) || line === '}}') {
            continue;
        }

        // Handle style block
        if (line.toLowerCase() === '<style>') {
            inStyle = true;
            continue;
        }
        if (line.toLowerCase() === '</style>') {
            inStyle = false;
            continue;
        }
        if (inStyle) {
            const bgMatch = rawLine.match(/BackgroundColor\s+(\S+)/i);
            if (bgMatch) {
                diagram.backgroundColor = bgMatch[1];
            }
            continue;
        }

        // Handle legend block
        if (line.toLowerCase() === 'legend') {
            inLegend = true;
            legendLines = [];
            continue;
        }
        if (line.toLowerCase() === 'end legend') {
            inLegend = false;
            diagram.legend = legendLines.join('\n');
            continue;
        }
        if (inLegend) {
            legendLines.push(line);
            continue;
        }

        // Handle sprite definitions
        if (!inSprite && line.startsWith('<<') && !line.endsWith('>>')) {
            inSprite = true;
            spriteName = line.substring(2).trim();
            spriteLines = [];
            continue;
        }
        if (inSprite) {
            if (line === '>>') {
                inSprite = false;
                diagram.sprites.set(spriteName, spriteLines);
            } else {
                spriteLines.push(rawLine);
            }
            continue;
        }

        // Single line directives
        const titleMatch = line.match(/^title\s+(.*)$/i);
        if (titleMatch) {
            diagram.title = titleMatch[1];
            continue;
        }

        const headerMatch = line.match(/^header\s+(.*)$/i);
        if (headerMatch) {
            diagram.header = headerMatch[1];
            continue;
        }

        const footerMatch = line.match(/^footer\s+(.*)$/i);
        if (footerMatch) {
            diagram.footer = footerMatch[1];
            continue;
        }

        const captionMatch = line.match(/^caption\s+(.*)$/i);
        if (captionMatch) {
            diagram.caption = captionMatch[1];
            continue;
        }

        const scaleMatch = line.match(/^scale\s+([\d.]+)/i);
        if (scaleMatch) {
            diagram.scale = parseFloat(scaleMatch[1]);
            continue;
        }

        const dpiMatch = line.match(/^skinparam\s+dpi\s+(\d+)/i);
        if (dpiMatch) {
            diagram.dpi = parseInt(dpiMatch[1]);
            continue;
        }

        const bgMatch = line.match(/^skinparam\s+Backgroundcolor\s+(\S+)/i);
        if (bgMatch) {
            diagram.backgroundColor = bgMatch[1];
            continue;
        }

        const handMatch = line.match(/^!option\s+handwritten\s+true/i);
        if (handMatch) {
            diagram.handwritten = true;
            continue;
        }

        // Ignore comments
        if (line.startsWith("'")) {
            continue;
        }

        bodyLines.push(rawLine);
    }

    const processedBodyLines: string[] = [];
    for (let i = 0; i < bodyLines.length; i++) {
        let currentLine = bodyLines[i];
        while (currentLine.trim().endsWith('|') && i + 1 < bodyLines.length) {
            i++;
            currentLine += bodyLines[i];
        }
        processedBodyLines.push(currentLine);
    }

    return processedBodyLines.join('\n');
}

interface Token {
    type:
        | 'LBRACE_GRID'
        | 'LBRACE_TREE'
        | 'LBRACE_TABS'
        | 'LBRACE_MENU'
        | 'LBRACE_SCROLL'
        | 'RBRACE'
        | 'PIPE'
        | 'NEWLINE'
        | 'BUTTON'
        | 'CHECKBOX'
        | 'RADIO'
        | 'INPUT'
        | 'DROPLIST'
        | 'SPRITE_REF'
        | 'TEXT'
        | 'EOF';
    value: string;
    checked?: boolean;
    style?: string;
    open?: boolean;
    items?: string[];
}

class SaltTokenizer {
    private source: string;
    private current = 0;

    constructor(source: string) {
        this.source = source;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        while (this.current < this.source.length) {
            const char = this.peek();

            if (char === ' ' || char === '\t') {
                this.advance();
                continue;
            }

            if (char === '\n' || char === '\r') {
                if (char === '\r' && this.peekNext() === '\n') {
                    this.advance();
                }
                this.advance();
                tokens.push({ type: 'NEWLINE', value: '\n' });
                continue;
            }

            if (char === '|') {
                this.advance();
                tokens.push({ type: 'PIPE', value: '|' });
                continue;
            }

            if (char === '}') {
                this.advance();
                tokens.push({ type: 'RBRACE', value: '}' });
                continue;
            }

            if (char === '{') {
                tokens.push(this.scanLbrace());
                continue;
            }

            if (char === '"') {
                tokens.push(this.scanInput());
                continue;
            }

            if (char === '[') {
                tokens.push(this.scanBracket());
                continue;
            }

            if (char === '(') {
                tokens.push(this.scanRadio());
                continue;
            }

            if (char === '^') {
                tokens.push(this.scanDroplist());
                continue;
            }

            if (char === '<' && this.peekNext() === '<') {
                tokens.push(this.scanSpriteRef());
                continue;
            }

            tokens.push(this.scanText());
        }
        tokens.push({ type: 'EOF', value: '' });
        return tokens;
    }

    private peek(): string {
        if (this.current >= this.source.length) return '\0';
        return this.source[this.current];
    }

    private peekNext(): string {
        if (this.current + 1 >= this.source.length) return '\0';
        return this.source[this.current + 1];
    }

    private advance(): string {
        const char = this.peek();
        this.current++;
        return char;
    }

    private scanLbrace(): Token {
        this.advance(); // consume '{'
        const next = this.peek();
        
        if (next === 'T') {
            this.advance(); // consume 'T'
            const style = this.peek();
            if (['!', '-', '+', '#'].includes(style)) {
                this.advance();
                return { type: 'LBRACE_TREE', value: '{T' + style, style };
            }
            return { type: 'LBRACE_TREE', value: '{T', style: 'none' };
        }

        if (next === '/') {
            this.advance(); // consume '/'
            return { type: 'LBRACE_TABS', value: '{/' };
        }

        if (next === '*') {
            this.advance(); // consume '*'
            return { type: 'LBRACE_MENU', value: '{*' };
        }

        if (next === 'S') {
            this.advance(); // consume 'S'
            const style = this.peek();
            if (style === 'I') {
                this.advance();
                return { type: 'LBRACE_SCROLL', value: '{SI', style: 'SI' };
            }
            if (style === '-') {
                this.advance();
                return { type: 'LBRACE_SCROLL', value: '{S-', style: 'S-' };
            }
            return { type: 'LBRACE_SCROLL', value: '{S', style: 'S' };
        }

        if (next === '^') {
            this.advance(); // consume '^'
            return { type: 'LBRACE_GRID', value: '{^', style: '^' };
        }

        if (['+', '-', '!', '#'].includes(next)) {
            this.advance();
            return { type: 'LBRACE_GRID', value: '{' + next, style: next };
        }

        return { type: 'LBRACE_GRID', value: '{', style: 'none' };
    }

    private scanInput(): Token {
        this.advance(); // consume "
        let value = '';
        while (this.peek() !== '"' && this.peek() !== '\0') {
            if (this.peek() === '\\' && this.peekNext() === '"') {
                value += '"';
                this.advance();
                this.advance();
            } else {
                value += this.advance();
            }
        }
        if (this.peek() === '"') {
            this.advance();
        }
        return { type: 'INPUT', value };
    }

    private scanBracket(): Token {
        const next1 = this.peekNext();
        const next2 = this.current + 2 < this.source.length ? this.source[this.current + 2] : '';
        
        const isUncheckedNoSpace = next1 === ']';
        const isUncheckedWithSpace = next1 === ' ' && next2 === ']';
        const isChecked = next1.toUpperCase() === 'X' && next2 === ']';
        
        if (isUncheckedNoSpace || isUncheckedWithSpace || isChecked) {
            this.advance(); // consume '['
            this.advance(); // consume ']' or ' ' or 'X'/'x'
            if (isUncheckedWithSpace || isChecked) {
                this.advance(); // consume ']'
            }
            
            let label = '';
            while (!['|', '\n', '\r', '}', '{', '\0'].includes(this.peek())) {
                label += this.advance();
            }
            return { type: 'CHECKBOX', value: label.trim(), checked: isChecked };
        }

        this.advance(); // consume '['
        let label = '';
        while (this.peek() !== ']' && this.peek() !== '\0') {
            label += this.advance();
        }
        if (this.peek() === ']') {
            this.advance();
        }
        return { type: 'BUTTON', value: label };
    }

    private scanRadio(): Token {
        const next1 = this.peekNext();
        const next2 = this.current + 2 < this.source.length ? this.source[this.current + 2] : '';

        const isUncheckedNoSpace = next1 === ')';
        const isUncheckedWithSpace = next1 === ' ' && next2 === ')';
        const isChecked = next1.toUpperCase() === 'X' && next2 === ')';

        if (isUncheckedNoSpace || isUncheckedWithSpace || isChecked) {
            this.advance(); // consume '('
            this.advance(); // consume ')' or ' ' or 'X'/'x'
            if (isUncheckedWithSpace || isChecked) {
                this.advance(); // consume ')'
            }

            let label = '';
            while (!['|', '\n', '\r', '}', '{', '\0'].includes(this.peek())) {
                label += this.advance();
            }
            return { type: 'RADIO', value: label.trim(), checked: isChecked };
        }

        this.advance();
        return { type: 'TEXT', value: '(' };
    }

    private scanDroplist(): Token {
        this.advance(); // consume '^'
        
        let content = '';
        while (!['|', '\n', '\r', '}', '{', '\0'].includes(this.peek())) {
            content += this.advance();
        }

        if (content.endsWith('^')) {
            content = content.substring(0, content.length - 1);
        }

        const parts = content.split(/\^+/).map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) {
            return { type: 'DROPLIST', value: '', open: false };
        }

        const label = parts[0];
        const items = parts.slice(1);
        return {
            type: 'DROPLIST',
            value: label,
            open: items.length > 0,
            items
        };
    }

    private scanSpriteRef(): Token {
        this.advance(); // consume '<'
        this.advance(); // consume '<'
        let name = '';
        while (!(this.peek() === '>' && this.peekNext() === '>') && this.peek() !== '\0') {
            name += this.advance();
        }
        if (this.peek() === '>') {
            this.advance();
            this.advance();
        }
        return { type: 'SPRITE_REF', value: name.trim() };
    }

    private scanText(): Token {
        let value = '';
        while (true) {
            const char = this.peek();
            if (char === '\0') break;
            if (['|', '\n', '\r', '}', '{', '[', '(', '^', '"'].includes(char)) break;
            if (char === '<' && this.peekNext() === '<') break;
            value += this.advance();
        }
        return { type: 'TEXT', value: value.trim() };
    }
}

function parseLineStyle(style: string | undefined): LineStyle {
    switch (style) {
        case '#':
            return 'all';
        case '!':
            return 'vertical';
        case '-':
            return 'horizontal';
        case '+':
            return 'external';
        default:
            return 'none';
    }
}

class SaltParserEngine {
    private tokens: Token[];
    private current = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    parse(): Widget | undefined {
        this.skipNewlines();
        if (this.peek().type === 'EOF') return undefined;
        return this.parseWidget();
    }

    private peek(): Token {
        if (this.current >= this.tokens.length) {
            return { type: 'EOF', value: '' };
        }
        return this.tokens[this.current];
    }

    private advance(): Token {
        const token = this.peek();
        this.current++;
        return token;
    }

    private skipNewlines() {
        while (this.peek().type === 'NEWLINE') {
            this.advance();
        }
    }

    private parseWidget(): Widget {
        const token = this.peek();

        if (token.type === 'LBRACE_GRID') {
            return this.parseGrid();
        }
        if (token.type === 'LBRACE_TREE') {
            return this.parseTree();
        }
        if (token.type === 'LBRACE_TABS') {
            return this.parseTabs();
        }
        if (token.type === 'LBRACE_MENU') {
            return this.parseMenu();
        }
        if (token.type === 'LBRACE_SCROLL') {
            return this.parseScroll();
        }

        this.advance();
        
        if (token.type === 'BUTTON') {
            return { type: 'button', label: token.value };
        }
        if (token.type === 'CHECKBOX') {
            return { type: 'checkbox', label: token.value, checked: token.checked || false };
        }
        if (token.type === 'RADIO') {
            return { type: 'radio', label: token.value, checked: token.checked || false };
        }
        if (token.type === 'INPUT') {
            return { type: 'input', label: token.value };
        }
        if (token.type === 'DROPLIST') {
            return { type: 'droplist', label: token.value, open: token.open || false, items: token.items };
        }
        if (token.type === 'SPRITE_REF') {
            return { type: 'sprite', name: token.value };
        }
        
        const textVal = token.value;
        const sepMatch = textVal.match(/^(\.\.|==|~~|--)(.*)$/);
        if (sepMatch) {
            const symbol = sepMatch[1];
            const title = sepMatch[2].trim();
            let style: 'dotted' | 'double' | 'strong' | 'single' = 'single';
            if (symbol === '..') style = 'dotted';
            else if (symbol === '==') style = 'double';
            else if (symbol === '~~') style = 'strong';
            else if (symbol === '--') style = 'single';
            return { type: 'separator', style, title: title || undefined };
        }

        return { type: 'label', text: textVal };
    }

    private parseGrid(): Widget {
        const startToken = this.advance(); // consume LBRACE_GRID
        
        if (startToken.style === '^') {
            let title = '';
            if (this.peek().type === 'INPUT') {
                title = this.advance().value;
            }
            const gridContent = this.parseGridBody('none');
            return {
                type: 'groupbox',
                title,
                content: gridContent
            };
        }

        const lineStyle = parseLineStyle(startToken.style);
        return this.parseGridBody(lineStyle);
    }

    private parseGridBody(lineStyle: LineStyle): GridWidget {
        const rows: Widget[][] = [];
        let currentRow: Widget[] = [];

        while (true) {
            const token = this.peek();
            if (token.type === 'EOF') break;
            if (token.type === 'RBRACE') {
                this.advance();
                break;
            }

            if (token.type === 'NEWLINE') {
                this.advance();
                if (currentRow.length > 0) {
                    rows.push(currentRow);
                    currentRow = [];
                }
                continue;
            }

            if (token.type === 'PIPE') {
                this.advance();
                if (currentRow.length === 0) {
                    currentRow.push({ type: 'label', text: '' });
                }
                continue;
            }

            const widget = this.parseWidget();
            currentRow.push(widget);
        }

        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        return { type: 'grid', lineStyle, rows };
    }

    private parseTree(): TreeWidget {
        const startToken = this.advance(); // consume LBRACE_TREE
        const lineStyle = parseLineStyle(startToken.style);

        const nodes: TreeNode[] = [];

        while (true) {
            const token = this.peek();
            if (token.type === 'EOF') break;
            if (token.type === 'RBRACE') {
                this.advance();
                break;
            }

            if (token.type === 'NEWLINE') {
                this.advance();
                continue;
            }

            const cells: Widget[] = [];
            let currentLineLevel = 0;

            const firstWidget = this.parseWidget();
            if (firstWidget.type === 'label') {
                const match = firstWidget.text.match(/^(\++)\s*(.*)$/);
                if (match) {
                    currentLineLevel = match[1].length;
                    firstWidget.text = match[2];
                }
            }
            cells.push(firstWidget);

            while (this.peek().type === 'PIPE' || (this.peek().type !== 'NEWLINE' && this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF')) {
                if (this.peek().type === 'PIPE') {
                    this.advance();
                    continue;
                }
                cells.push(this.parseWidget());
            }

            nodes.push({
                level: currentLineLevel || 1,
                cells
            });
        }

        return { type: 'tree', lineStyle, nodes };
    }

    private parseTabs(): TabWidget {
        this.advance(); // consume LBRACE_TABS
        
        const tabItems: string[] = [];
        let vertical = true;

        let isHorizontal = false;
        let index = this.current;
        while (index < this.tokens.length) {
            const t = this.tokens[index];
            if (t.type === 'RBRACE' || t.type === 'EOF') break;
            if (t.type === 'PIPE') {
                isHorizontal = true;
                break;
            }
            index++;
        }

        vertical = !isHorizontal;

        let currentItem = '';
        while (true) {
            const token = this.peek();
            if (token.type === 'EOF') break;
            if (token.type === 'RBRACE') {
                this.advance();
                if (currentItem.trim()) tabItems.push(currentItem.trim());
                break;
            }

            if (vertical && token.type === 'NEWLINE') {
                this.advance();
                if (currentItem.trim()) {
                    tabItems.push(currentItem.trim());
                    currentItem = '';
                }
                continue;
            }

            if (!vertical && token.type === 'PIPE') {
                this.advance();
                if (currentItem.trim()) {
                    tabItems.push(currentItem.trim());
                    currentItem = '';
                }
                continue;
            }

            currentItem += (currentItem ? ' ' : '') + token.value;
            this.advance();
        }

        let activeIndex = 0;
        for (let i = 0; i < tabItems.length; i++) {
            const item = tabItems[i];
            if (item.includes('<b>') || item.includes('**')) {
                activeIndex = i;
                break;
            }
        }

        const cleanTabs = tabItems.map(item => {
            return item.replace(/<b>|<\/b>|\*\*/g, '').trim();
        });

        return {
            type: 'tabs',
            tabs: cleanTabs,
            vertical,
            activeIndex
        };
    }

    private parseMenu(): MenuWidget {
        this.advance(); // consume LBRACE_MENU

        const items: string[] = [];
        let currentItem = '';
        let openIndex: number | undefined;
        let dropdownItems: string[] | undefined;

        while (true) {
            const token = this.peek();
            if (token.type === 'EOF') break;
            if (token.type === 'RBRACE') {
                this.advance();
                if (currentItem.trim()) items.push(currentItem.trim());
                break;
            }

            if (token.type === 'NEWLINE') {
                this.advance();
                if (currentItem.trim()) items.push(currentItem.trim());
                currentItem = '';
                
                this.skipNewlines();
                if (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
                    const dropdownRow: string[] = [];
                    let ddItem = '';
                    while (true) {
                        const ddToken = this.peek();
                        if (ddToken.type === 'EOF' || ddToken.type === 'RBRACE' || ddToken.type === 'NEWLINE') {
                            if (ddItem.trim()) dropdownRow.push(ddItem.trim());
                            break;
                        }
                        if (ddToken.type === 'PIPE') {
                            this.advance();
                            if (ddItem.trim()) dropdownRow.push(ddItem.trim());
                            ddItem = '';
                            continue;
                        }
                        ddItem += (ddItem ? ' ' : '') + ddToken.value;
                        this.advance();
                    }

                    if (dropdownRow.length > 0) {
                        const trigger = dropdownRow[0];
                        const idx = items.findIndex(it => it.toLowerCase() === trigger.toLowerCase());
                        if (idx !== -1) {
                            openIndex = idx;
                            dropdownItems = dropdownRow.slice(1);
                        }
                    }
                }
                continue;
            }

            if (token.type === 'PIPE') {
                this.advance();
                if (currentItem.trim()) items.push(currentItem.trim());
                currentItem = '';
                continue;
            }

            currentItem += (currentItem ? ' ' : '') + token.value;
            this.advance();
        }

        return {
            type: 'menu',
            items: items.map(it => it.trim()),
            openIndex,
            dropdownItems
        };
    }

    private parseScroll(): ScrollWidget {
        const startToken = this.advance(); // consume LBRACE_SCROLL
        const style = startToken.style || 'S';

        let content: Widget;
        
        if (this.peek().type === 'LBRACE_GRID') {
            content = this.parseGrid();
        } else {
            const rows: Widget[][] = [];
            let currentRow: Widget[] = [];
            while (true) {
                const token = this.peek();
                if (token.type === 'EOF') break;
                if (token.type === 'RBRACE') {
                    this.advance();
                    break;
                }
                if (token.type === 'NEWLINE') {
                    this.advance();
                    if (currentRow.length > 0) {
                        rows.push(currentRow);
                        currentRow = [];
                    }
                    continue;
                }
                if (token.type === 'PIPE') {
                    this.advance();
                    continue;
                }
                currentRow.push(this.parseWidget());
            }
            if (currentRow.length > 0) {
                rows.push(currentRow);
            }
            content = { type: 'grid', lineStyle: 'none', rows };
        }

        return {
            type: 'scroll',
            horizontal: style === 'S' || style === 'S-',
            vertical: style === 'S' || style === 'SI',
            content
        };
    }
}

export class SaltParser implements Parser {
    parse(content: string): SaltDiagram {
        const diagram = new SaltDiagram();
        const bodyText = preprocessSalt(content, diagram);
        
        const tokenizer = new SaltTokenizer(bodyText);
        const tokens = tokenizer.tokenize();
        
        const parser = new SaltParserEngine(tokens);
        let root = parser.parse();
        
        if (!root) {
            root = { type: 'grid', lineStyle: 'none', rows: [] };
        }
        diagram.root = root;
        
        return diagram;
    }
}
