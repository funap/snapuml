import { Parser } from '../../core/Parser';
import {
    WireDiagram,
    WireFace,
    normalizeFace,
    ArrowInfo,
    ArrowDirection,
    ProtocolInfo,
    WireComponent,
    WireConnection,
    WireBusChild,
    WireCallout
} from './WireDiagram';

export class WireParser implements Parser {
    parse(content: string): WireDiagram {
        const diagram = new WireDiagram();
        const preprocessed = this.stripComments(content);
        const tokens = this.tokenize(preprocessed);
        this.parseTokens(tokens, diagram);
        return diagram;
    }

    private stripComments(source: string): string {
        // Strip block comments /* ... */
        let cleaned = source.replace(/\/\*[\s\S]*?\*\//g, '');

        const lines = cleaned.split('\n');
        const resultLines: string[] = [];

        for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('@') || trimmed.startsWith('!pragma')) {
                continue;
            }

            // Remove line comments: #, //, '
            let inQuote = false;
            let quoteChar = '';
            let commentStart = -1;

            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if ((ch === '"' || ch === "'") && (i === 0 || line[i - 1] !== '\\')) {
                    if (!inQuote) {
                        inQuote = true;
                        quoteChar = ch;
                    } else if (quoteChar === ch) {
                        inQuote = false;
                    }
                } else if (!inQuote) {
                    if (ch === '#') {
                        const prefix = line.substring(0, i);
                        if (!/color:\s*$/i.test(prefix)) {
                            commentStart = i;
                            break;
                        }
                    } else if (ch === '/' && line[i + 1] === '/') {
                        commentStart = i;
                        break;
                    } else if (ch === "'") {
                        commentStart = i;
                        break;
                    }
                }
            }

            if (commentStart >= 0) {
                line = line.substring(0, commentStart);
            }

            if (line.trim().length > 0) {
                resultLines.push(line);
            }
        }

        return resultLines.join('\n');
    }

    private tokenize(text: string): string[] {
        const tokens: string[] = [];
        let i = 0;
        const len = text.length;

        while (i < len) {
            const ch = text[i];

            // Newlines and semicolons as statement separators
            if (ch === '\n' || ch === ';') {
                if (tokens.length === 0 || tokens[tokens.length - 1] !== '\n') {
                    tokens.push('\n');
                }
                i++;
                continue;
            }

            // Other whitespace
            if (/[ \t\r]/.test(ch)) {
                i++;
                continue;
            }

            // String literal
            if (ch === '"' || ch === "'") {
                let str = ch;
                const quote = ch;
                i++;
                while (i < len) {
                    const c = text[i];
                    str += c;
                    if (c === quote && text[i - 1] !== '\\') {
                        i++;
                        break;
                    }
                    i++;
                }
                tokens.push(str);
                continue;
            }

            // Braces and brackets
            if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
                tokens.push(ch);
                i++;
                continue;
            }

            // Word or symbol token
            let token = '';
            while (i < len && !/[ \t\r\n;]/.test(text[i]) && !'{}[]"\''.includes(text[i])) {
                token += text[i];
                i++;
            }
            if (token) {
                tokens.push(token);
            }
        }

        return tokens;
    }

    private parseTokens(tokens: string[], diagram: WireDiagram): void {
        let i = 0;
        let currentBoardId: string | undefined = undefined;

        while (i < tokens.length) {
            const token = tokens[i];

            if (token === '\n') {
                i++;
                continue;
            }

            if (token === '}') {
                if (currentBoardId) {
                    currentBoardId = undefined;
                }
                i++;
                continue;
            }

            // board BOARD_ID ["Title"] { ... }
            if (token.toLowerCase() === 'board') {
                i++;
                const boardId = tokens[i++];
                let label = boardId;
                if (i < tokens.length && (tokens[i].startsWith('"') || tokens[i].startsWith("'"))) {
                    label = this.unquote(tokens[i++]);
                }
                diagram.boards.set(boardId, {
                    id: boardId,
                    label,
                    componentIds: []
                });
                if (i < tokens.length && tokens[i] === '{') {
                    currentBoardId = boardId;
                    i++;
                }
                continue;
            }

            // Board attribute: note: "..."
            if (token.toLowerCase() === 'note:' && currentBoardId) {
                i++;
                if (i < tokens.length && tokens[i] !== '\n') {
                    const board = diagram.boards.get(currentBoardId);
                    if (board) {
                        board.note = this.unquote(tokens[i]);
                    }
                    i++;
                }
                continue;
            }

            // Callouts: warning for ..., note for ..., note "..." @ near(...)
            if (token.toLowerCase() === 'warning' || token.toLowerCase() === 'note') {
                const calloutType = token.toLowerCase() as 'warning' | 'note';
                i++;
                if (i < tokens.length && tokens[i].toLowerCase() === 'for') {
                    i++; // skip 'for'
                    const targetRef = tokens[i++];
                    const { nodeId, face } = this.parseRef(targetRef);
                    let text = '';
                    if (i < tokens.length && (tokens[i].startsWith('"') || tokens[i].startsWith("'"))) {
                        text = this.unquote(tokens[i++]);
                    }
                    diagram.callouts.push({
                        id: `callout_${diagram.callouts.length + 1}`,
                        type: calloutType,
                        targetId: nodeId,
                        targetFace: face,
                        text
                    });
                    continue;
                } else if (i < tokens.length && (tokens[i].startsWith('"') || tokens[i].startsWith("'"))) {
                    const text = this.unquote(tokens[i++]);
                    let nearId: string | undefined = undefined;
                    if (i < tokens.length && tokens[i] === '@') {
                        i++;
                        if (i < tokens.length && /^near\((.*?)\)$/i.test(tokens[i])) {
                            const match = tokens[i].match(/^near\((.*?)\)$/i);
                            nearId = match ? match[1].trim() : undefined;
                            i++;
                        }
                    }
                    diagram.callouts.push({
                        id: `callout_${diagram.callouts.length + 1}`,
                        type: calloutType,
                        targetId: nearId || '',
                        nearId,
                        text
                    });
                    continue;
                }
            }

            // Look ahead ON THE CURRENT LINE (before \n or { or }) for an arrow
            let arrowIndex = -1;
            for (let j = i; j < tokens.length; j++) {
                if (tokens[j] === '\n' || tokens[j] === '{' || tokens[j] === '}') break;
                if (this.isArrow(tokens[j])) {
                    arrowIndex = j;
                    break;
                }
            }

            if (arrowIndex >= 0) {
                i = this.parseWiringOrBus(tokens, i, arrowIndex, currentBoardId, diagram);
                continue;
            }

            // Otherwise, it's a component declaration
            i = this.parseComponentDecl(tokens, i, currentBoardId, diagram);
        }
    }

    private isArrow(token: string): boolean {
        return /^[<]?[-=]+[>]?$/.test(token);
    }

    private parseArrow(token: string): ArrowInfo {
        const isDouble = token.includes('=');
        const inner = token.replace(/^[<]/, '').replace(/[>]$/, '');
        const distance = Math.max(1, inner.length);
        const hasStart = token.startsWith('<');
        const hasEnd = token.endsWith('>');

        let direction: ArrowDirection = 'none';
        if (hasStart && hasEnd) {
            direction = 'bidirectional';
        } else if (hasEnd) {
            direction = 'forward';
        } else if (hasStart) {
            direction = 'backward';
        }

        return {
            raw: token,
            direction,
            distance,
            isDouble
        };
    }

    private parseRef(raw: string): { boardId?: string; nodeId: string; face?: WireFace } {
        const parts = raw.split('.');
        const last = parts[parts.length - 1];
        const face = normalizeFace(last);

        if (face && parts.length > 1) {
            const remaining = parts.slice(0, parts.length - 1);
            if (remaining.length > 1) {
                return {
                    boardId: remaining[0],
                    nodeId: remaining.slice(1).join('.'),
                    face
                };
            } else {
                return {
                    nodeId: remaining[0],
                    face
                };
            }
        } else {
            if (parts.length > 1) {
                return {
                    boardId: parts[0],
                    nodeId: parts.slice(1).join('.')
                };
            } else {
                return {
                    nodeId: raw
                };
            }
        }
    }

    private parseWiringOrBus(
        tokens: string[],
        startIdx: number,
        arrowIdx: number,
        currentBoardId: string | undefined,
        diagram: WireDiagram
    ): number {
        const sourceToken = tokens[startIdx];
        const { boardId: srcBoardId, nodeId: srcNodeId, face: srcFace } = this.parseRef(sourceToken);
        let srcLabel: string | undefined = undefined;
        if (startIdx + 1 < arrowIdx && (tokens[startIdx + 1].startsWith('"') || tokens[startIdx + 1].startsWith("'"))) {
            srcLabel = this.unquote(tokens[startIdx + 1]);
        }
        const arrow = this.parseArrow(tokens[arrowIdx]);
        let i = arrowIdx + 1;

        const srcComp = diagram.getOrCreateComponent(srcNodeId, srcBoardId || currentBoardId);
        if (srcLabel) srcComp.label = srcLabel;

        // Check if next token is 'bus'
        if (i < tokens.length && tokens[i].toLowerCase() === 'bus') {
            i++; // skip 'bus'
            const busId = tokens[i++];
            let protocol: ProtocolInfo | undefined = undefined;

            if (i < tokens.length && tokens[i].startsWith(':')) {
                const protoTokens: string[] = [];
                while (i < tokens.length && tokens[i] !== '{' && tokens[i] !== '\n') {
                    protoTokens.push(tokens[i]);
                    i++;
                }
                protocol = this.parseProtocol(protoTokens.join(' '));
            }

            const busChildren: WireBusChild[] = [];
            // Advance to '{'
            while (i < tokens.length && tokens[i] === '\n') i++;

            if (i < tokens.length && tokens[i] === '{') {
                i++; // skip '{'
                while (i < tokens.length && tokens[i] !== '}') {
                    if (tokens[i] === '\n') {
                        i++;
                        continue;
                    }
                    if (this.isArrow(tokens[i])) {
                        const childArrow = this.parseArrow(tokens[i++]);
                        const targetToken = tokens[i++];
                        const { boardId: chBoardId, nodeId: chNodeId, face: chFace } = this.parseRef(targetToken);
                        let label: string | undefined = undefined;
                        if (i < tokens.length && (tokens[i].startsWith('"') || tokens[i].startsWith("'"))) {
                            label = this.unquote(tokens[i++]);
                        }
                        let noteOrAddr: string | undefined = undefined;
                        if (i < tokens.length && tokens[i].startsWith('(')) {
                            let parenStr = tokens[i++];
                            while (!parenStr.endsWith(')') && i < tokens.length) {
                                parenStr += ' ' + tokens[i++];
                            }
                            noteOrAddr = parenStr.replace(/^\(/, '').replace(/\)$/, '').trim();
                        }

                        const childComp = diagram.getOrCreateComponent(chNodeId, chBoardId || currentBoardId);
                        if (label) childComp.label = label;

                        busChildren.push({
                            arrow: childArrow,
                            targetId: chNodeId,
                            targetLabel: label,
                            targetFace: chFace,
                            noteOrAddr
                        });
                    } else {
                        i++;
                    }
                }
                if (i < tokens.length && tokens[i] === '}') {
                    i++; // skip '}'
                }
            }

            diagram.wires.push({
                id: `wire_${diagram.wires.length + 1}`,
                sourceId: srcNodeId,
                sourceFace: srcFace,
                targetId: busId,
                arrow,
                protocol,
                isBus: true,
                busId,
                busChildren
            });

            return i;
        }

        // Regular wiring
        const targetToken = tokens[i++];
        let { boardId: tgtBoardId, nodeId: tgtNodeId, face: tgtFace } = this.parseRef(targetToken);

        let label: string | undefined = undefined;
        if (i < tokens.length && (tokens[i].startsWith('"') || tokens[i].startsWith("'"))) {
            label = this.unquote(tokens[i++]);
        }

        if (i < tokens.length && tokens[i].startsWith('.')) {
            const faceStr = tokens[i++].substring(1);
            tgtFace = normalizeFace(faceStr) || tgtFace;
        }

        let isEdge = false;
        let edgeFace: WireFace | undefined = undefined;

        if (i < tokens.length && tokens[i].startsWith('@')) {
            let edgeToken = tokens[i++];
            if (edgeToken === '@' && i < tokens.length) {
                edgeToken += tokens[i++];
            }
            if (edgeToken.toLowerCase().startsWith('@edge')) {
                isEdge = true;
                const match = edgeToken.match(/@edge(?:\.([a-zA-Z]+))?/i);
                if (match && match[1]) {
                    edgeFace = normalizeFace(match[1]);
                }
            }
        }

        const targetComp = diagram.getOrCreateComponent(tgtNodeId, tgtBoardId || currentBoardId);
        if (label) targetComp.label = label;
        if (isEdge) {
            targetComp.isEdge = true;
            targetComp.edgeFace = edgeFace || targetComp.edgeFace;
        }

        let protocol: ProtocolInfo | undefined = undefined;
        let connector: string | undefined = undefined;
        let note: string | undefined = undefined;

        while (i < tokens.length) {
            const tk = tokens[i];
            if (tk === '\n' || tk === '}') break;

            if (tk.startsWith(':')) {
                const protoTokens: string[] = [tk];
                i++;
                while (i < tokens.length && tokens[i] !== 'via' && tokens[i] !== '[' && tokens[i] !== '\n' && tokens[i] !== '}') {
                    protoTokens.push(tokens[i]);
                    i++;
                }
                protocol = this.parseProtocol(protoTokens.join(' '));
            } else if (tk.toLowerCase() === 'via') {
                i++; // skip 'via'
                let connectorStr = '';
                while (i < tokens.length && tokens[i] !== '[' && tokens[i] !== '\n' && tokens[i] !== '}') {
                    connectorStr += tokens[i] + ' ';
                    i++;
                }
                const match = connectorStr.match(/connector\s*\(\s*(?:"([^"]*)"|'([^']*)')\s*\)/i);
                if (match) {
                    connector = match[1] || match[2];
                }
            } else if (tk === '[') {
                i++; // skip '['
                let noteTokens: string[] = [];
                while (i < tokens.length && tokens[i] !== ']' && tokens[i] !== '\n') {
                    noteTokens.push(tokens[i]);
                    i++;
                }
                if (i < tokens.length && tokens[i] === ']') {
                    i++; // skip ']'
                }
                const rawNote = noteTokens.join(' ').replace(/^note:\s*/i, '').trim();
                note = this.unquote(rawNote);
            } else {
                break;
            }
        }

        diagram.wires.push({
            id: `wire_${diagram.wires.length + 1}`,
            sourceId: srcNodeId,
            sourceFace: srcFace,
            targetId: tgtNodeId,
            targetFace: tgtFace,
            arrow,
            protocol,
            connector,
            note
        });

        return i;
    }

    private parseComponentDecl(
        tokens: string[],
        startIdx: number,
        currentBoardId: string | undefined,
        diagram: WireDiagram
    ): number {
        let i = startIdx;
        const compRef = tokens[i++];
        const { boardId, nodeId } = this.parseRef(compRef);
        const comp = diagram.getOrCreateComponent(nodeId, boardId || currentBoardId);

        // Optional label
        if (i < tokens.length && (tokens[i].startsWith('"') || tokens[i].startsWith("'"))) {
            comp.label = this.unquote(tokens[i++]);
        }

        // Optional @ edge[.face]
        if (i < tokens.length && tokens[i].startsWith('@')) {
            let edgeToken = tokens[i++];
            if (edgeToken === '@' && i < tokens.length) {
                edgeToken += tokens[i++];
            }
            if (edgeToken.toLowerCase().startsWith('@edge')) {
                comp.isEdge = true;
                const match = edgeToken.match(/@edge(?:\.([a-zA-Z]+))?/i);
                if (match && match[1]) {
                    comp.edgeFace = normalizeFace(match[1]);
                }
            }
        }

        // Optional body block { ... }
        // Advance any newlines before '{'
        let peekIdx = i;
        while (peekIdx < tokens.length && tokens[peekIdx] === '\n') peekIdx++;

        if (peekIdx < tokens.length && tokens[peekIdx] === '{') {
            i = peekIdx + 1; // skip '{'
            while (i < tokens.length && tokens[i] !== '}') {
                const key = tokens[i++];
                if (key === '\n') continue;
                if (key.toLowerCase() === 'width:' && i < tokens.length) {
                    const dim = this.parseDimension(tokens[i++]);
                    comp.userWidth = dim.value;
                    comp.widthUnit = dim.unit;
                } else if (key.toLowerCase() === 'height:' && i < tokens.length) {
                    const dim = this.parseDimension(tokens[i++]);
                    comp.userHeight = dim.value;
                    comp.heightUnit = dim.unit;
                } else if (key.toLowerCase() === 'color:' && i < tokens.length) {
                    comp.color = tokens[i++];
                } else if (key.toLowerCase() === 'note:' && i < tokens.length) {
                    comp.note = this.unquote(tokens[i++]);
                }
            }
            if (i < tokens.length && tokens[i] === '}') {
                i++; // skip '}'
            }
        }

        return i;
    }

    private parseDimension(str: string): { value: number; unit: 'px' | 'slots' } {
        const match = str.match(/^(\d+(?:\.\d+)?)\s*(px|slots)?$/i);
        if (match) {
            const value = parseFloat(match[1]);
            const unit = (match[2]?.toLowerCase() === 'slots') ? 'slots' : 'px';
            return { value, unit };
        }
        return { value: parseFloat(str) || 0, unit: 'px' };
    }

    private parseProtocol(raw: string): ProtocolInfo {
        const cleaned = raw.replace(/^:\s*/, '').trim();
        const match = cleaned.match(/^([\w-]+)(?:\s*\(([\s\S]*)\))?$/);
        const params = new Map<string, string>();
        if (match) {
            const name = match[1].toLowerCase();
            const args = match[2] ? match[2].trim() : undefined;
            if (args) {
                const parts = args.split(',');
                for (const part of parts) {
                    const kv = part.split(':');
                    if (kv.length === 2) {
                        params.set(kv[0].trim(), kv[1].trim());
                    } else {
                        params.set(part.trim(), part.trim());
                    }
                }
            }
            return { name, raw: cleaned, args, params };
        }
        return { name: cleaned.toLowerCase(), raw: cleaned, params };
    }

    private unquote(str: string): string {
        str = str.trim();
        if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            return str.substring(1, str.length - 1);
        }
        return str;
    }
}
