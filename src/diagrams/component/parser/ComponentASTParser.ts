import { Token, TokenType, ParseError } from '../../../core/parser/Token';
import {
    ComponentDiagramAST,
    ComponentASTNode,
    ComponentDeclAST,
    PortDeclAST,
    GroupContainerAST,
    RelationshipAST,
    ComponentNoteAST,
    PositionHintAST
} from './ComponentAST';

export class ComponentASTParser {
    private tokens: Token[];
    private current = 0;
    private source: string;
    private sourceLines: string[];

    constructor(tokens: Token[], source: string) {
        this.tokens = tokens;
        this.source = source;
        this.sourceLines = source.split('\n');
    }

    private sliceSource(startLine: number, startCol: number, endLine: number, endCol: number): string {
        const startLineIdx = startLine - 1;
        const startColIdx = startCol - 1;
        const endLineIdx = endLine - 1;
        const endColIdx = endCol - 1;

        if (startLineIdx === endLineIdx) {
            return this.sourceLines[startLineIdx].substring(startColIdx, endColIdx);
        }

        const parts: string[] = [];
        parts.push(this.sourceLines[startLineIdx].substring(startColIdx));
        for (let i = startLineIdx + 1; i < endLineIdx; i++) {
            parts.push(this.sourceLines[i]);
        }
        parts.push(this.sourceLines[endLineIdx].substring(0, endColIdx));
        return parts.join('\n');
    }

    parse(): ComponentDiagramAST {
        const body: ComponentASTNode[] = [];
        while (!this.isAtEnd()) {
            this.skipNewlines();
            if (this.isAtEnd()) break;

            const statement = this.parseStatement();
            if (statement) {
                body.push(statement);
            }
            this.consumeNewlineOrEOF();
        }

        return {
            type: 'ComponentDiagram',
            body,
            line: 1,
            column: 1
        };
    }

    private parseStatement(): ComponentASTNode | null {
        const token = this.peek();

        // 1. Group End
        if (token.type === TokenType.RBRACE) {
            return null; // Let the caller (parseGroup) handle the closing brace
        }

        // 2. Groups (package, node, folder, frame, cloud, database, component, interface)
        if (
            token.type === TokenType.PACKAGE ||
            token.type === TokenType.NODE ||
            token.type === TokenType.FOLDER ||
            token.type === TokenType.FRAME ||
            token.type === TokenType.CLOUD ||
            token.type === TokenType.DATABASE ||
            ((token.type === TokenType.COMPONENT || token.type === TokenType.INTERFACE) &&
                this.checkLbraceAhead())
        ) {
            return this.parseGroup();
        }

        // 3. Port declarations (port, portin, portout)
        if (token.type === TokenType.PORT || token.type === TokenType.PORTIN || token.type === TokenType.PORTOUT) {
            return this.parsePort();
        }

        // 4. Notes
        if (token.type === TokenType.NOTE) {
            return this.parseNote();
        }

        // 5. Component / Interface definitions or Relationships or Position Hints
        // We first parse the LHS element
        const lhs = this.parseRefElement();
        if (!lhs) {
            this.advance(); // Fallback to avoid infinite loop
            return null;
        }

        // Now peek at the next token to determine if it is a Relationship or PositionHint or Declaration
        const next = this.peek();

        // 5a. Position Hint: [A] left/right/top/bottom of [B]
        if (
            lhs.isBracketed &&
            (next.type === TokenType.LEFT ||
                next.type === TokenType.RIGHT ||
                next.type === TokenType.TOP ||
                next.type === TokenType.BOTTOM)
        ) {
            const posToken = this.advance();
            const position = posToken.value.toLowerCase() as 'left' | 'right' | 'top' | 'bottom';

            this.consume(TokenType.OF, "Expected 'of' after direction hint");
            const rhs = this.parseRefElement();
            if (!rhs) {
                throw this.error(posToken, "Expected reference component after 'of'");
            }

            let color: string | undefined;
            if (this.match(TokenType.COLOR)) {
                color = this.previous().value;
            }

            return {
                type: 'PositionHint',
                name: lhs.name,
                position,
                reference: rhs.name,
                color,
                line: token.line,
                column: token.column
            };
        }

        // 5b. Relationship: lhs ARROW rhs [: label]
        if (next.type === TokenType.ARROW || (next.type === TokenType.SHORTHAND && next.value === '--')) {
            const arrowToken = this.advance();
            const rhs = this.parseRefElement();
            if (!rhs) {
                throw this.error(arrowToken, "Expected right-hand side component in relationship");
            }

            let label: string | undefined;
            if (this.match(TokenType.COLON)) {
                label = this.parseLabelRestOfLine();
            }

            return {
                type: 'Relationship',
                from: { name: lhs.name, isBracketed: lhs.isBracketed, isParens: lhs.isParens },
                to: { name: rhs.name, isBracketed: rhs.isBracketed, isParens: rhs.isParens },
                arrow: arrowToken.value,
                label,
                line: token.line,
                column: token.column
            };
        }

        // 5c. Explicit Declarations: component [Name] as Alias #Color
        // If the lhs element we parsed is already a standalone declaration keyword:
        if (lhs.keywordType === 'component' || lhs.keywordType === 'interface') {
            let color: string | undefined;
            if (this.match(TokenType.COLOR)) {
                color = this.previous().value;
            }

            let description: string | undefined;
            // Check for multiline description block starting with LBRACKET '['
            if (this.match(TokenType.LBRACKET)) {
                description = this.parseMultilineDescription();
            }

            return {
                type: 'ComponentDeclaration',
                declType: lhs.keywordType,
                name: lhs.name,
                label: lhs.rawName,
                alias: lhs.alias,
                color,
                description,
                line: token.line,
                column: token.column
            };
        }

        // If it's a bracketed style [Comp] or lollipop style () Interf or standalone word, it's a simplified declaration
        let alias: string | undefined;
        if (this.match(TokenType.AS)) {
            alias = this.consume(TokenType.IDENTIFIER, "Expected alias after 'as'").value;
        }

        let color: string | undefined;
        if (this.match(TokenType.COLOR)) {
            color = this.previous().value;
        }

        let description: string | undefined;
        if (this.match(TokenType.LBRACKET)) {
            description = this.parseMultilineDescription();
        }

        return {
            type: 'ComponentDeclaration',
            declType: lhs.isParens ? 'interface' : 'component',
            name: alias || lhs.name,
            label: lhs.rawName,
            alias,
            color,
            description,
            line: token.line,
            column: token.column
        };
    }

    private parseRefElement(): {
        name: string;
        rawName: string;
        isBracketed: boolean;
        isParens: boolean;
        keywordType?: 'component' | 'interface';
        alias?: string;
    } | null {
        const startToken = this.peek();

        // 1. Lollipop notation () "Name" as Alias
        if (startToken.type === TokenType.IDENTIFIER && startToken.value === '()') {
            this.advance(); // consume '()'
            const nameToken = this.consume(TokenType.IDENTIFIER, "Expected name after lollipop '()'");
            let name = nameToken.value;
            let alias: string | undefined;

            if (this.match(TokenType.AS)) {
                alias = this.consume(TokenType.IDENTIFIER, "Expected alias after 'as'").value;
            }

            return {
                name: alias || name,
                rawName: name,
                isBracketed: false,
                isParens: true,
                alias
            };
        }

        // 2. Bracket style: [Name] as Alias
        if (this.match(TokenType.LBRACKET)) {
            const startToken = this.previous();
            while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
                this.advance();
            }
            const endToken = this.consume(TokenType.RBRACKET, "Expected closing bracket ']'");
            const name = this.sliceSource(
                startToken.line,
                startToken.column + startToken.value.length,
                endToken.line,
                endToken.column
            );
            let alias: string | undefined;

            if (this.match(TokenType.AS)) {
                alias = this.consume(TokenType.IDENTIFIER, "Expected alias after 'as'").value;
            }

            return {
                name: alias || name,
                rawName: name,
                isBracketed: true,
                isParens: false,
                alias
            };
        }

        // 3. Keyword declarations: component "Name" as Alias
        if (this.match(TokenType.COMPONENT, TokenType.INTERFACE)) {
            const keywordType = this.previous().type === TokenType.COMPONENT ? 'component' : 'interface';
            
            // Next could be bracketed [Name] or identifier or quoted string
            let name = '';
            let isBracketed = false;
            let label: string | undefined;

            if (this.match(TokenType.LBRACKET)) {
                const startToken = this.previous();
                while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
                    this.advance();
                }
                const endToken = this.consume(TokenType.RBRACKET, "Expected closing bracket ']'");
                name = this.sliceSource(
                    startToken.line,
                    startToken.column + startToken.value.length,
                    endToken.line,
                    endToken.column
                );
                isBracketed = true;
            } else {
                const nameToken = this.consume(TokenType.IDENTIFIER, "Expected name after keyword");
                name = nameToken.value;
            }

            let alias: string | undefined;
            if (this.match(TokenType.AS)) {
                alias = this.consume(TokenType.IDENTIFIER, "Expected alias after 'as'").value;
            }

            return {
                name: alias || name,
                rawName: name,
                isBracketed,
                isParens: keywordType === 'interface',
                keywordType,
                alias
            };
        }

        // 4. Standalone identifier/quoted name
        if (this.match(TokenType.IDENTIFIER)) {
            const name = this.previous().value;
            return {
                name,
                rawName: name,
                isBracketed: false,
                isParens: false
            };
        }

        return null;
    }

    private parseGroup(): GroupContainerAST {
        const startToken = this.advance(); // package, node, folder, etc.
        const containerType = startToken.value.toLowerCase() as any;

        let name = '';
        if (this.match(TokenType.IDENTIFIER)) {
            name = this.previous().value;
        }

        this.consume(TokenType.LBRACE, "Expected '{' to start group block");
        this.consumeNewlineOrEOF();

        const body: ComponentASTNode[] = [];
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            this.skipNewlines();
            if (this.check(TokenType.RBRACE)) break;

            const statement = this.parseStatement();
            if (statement) {
                body.push(statement);
            }
            this.consumeNewlineOrEOF();
        }

        this.consume(TokenType.RBRACE, "Expected '}' to close group block");

        return {
            type: 'GroupContainer',
            containerType,
            name,
            body,
            line: startToken.line,
            column: startToken.column
        };
    }

    private parsePort(): PortDeclAST {
        const startToken = this.advance(); // port, portin, portout
        const portType = startToken.value.toLowerCase() as 'port' | 'portin' | 'portout';

        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected name for port");
        let name = nameToken.value;
        let alias: string | undefined;

        if (this.match(TokenType.AS)) {
            alias = this.consume(TokenType.IDENTIFIER, "Expected alias after 'as'").value;
        }

        return {
            type: 'PortDeclaration',
            portType,
            name: alias || name,
            label: name,
            alias,
            line: startToken.line,
            column: startToken.column
        };
    }

    private parseNote(): ComponentNoteAST {
        const startToken = this.advance(); // note

        // 1. Floating note: note as Alias
        if (this.match(TokenType.AS)) {
            const aliasToken = this.consume(TokenType.IDENTIFIER, "Expected alias after 'as' in floating note");
            this.consumeNewlineOrEOF();

            const text = this.parseMultilineNoteText();

            return {
                type: 'ComponentNote',
                alias: aliasToken.value,
                text,
                line: startToken.line,
                column: startToken.column
            };
        }

        // 2. Positioned note: note left/right/top/bottom of Target
        let position: 'left' | 'right' | 'top' | 'bottom';
        if (this.match(TokenType.LEFT)) position = 'left';
        else if (this.match(TokenType.RIGHT)) position = 'right';
        else if (this.match(TokenType.TOP)) position = 'top';
        else if (this.match(TokenType.BOTTOM)) position = 'bottom';
        else {
            throw this.error(this.peek(), "Expected direction (left, right, top, bottom) in note");
        }

        this.consume(TokenType.OF, "Expected 'of' in note declaration");

        // Note target (bracketed or plain)
        const target = this.parseRefElement();
        if (!target) {
            throw this.error(this.peek(), "Expected target after 'of' in note declaration");
        }

        // Check if inline note: note right of Target : text
        if (this.match(TokenType.COLON)) {
            const text = this.parseLabelRestOfLine();
            return {
                type: 'ComponentNote',
                position,
                linkedTo: { name: target.name, isBracketed: target.isBracketed },
                text,
                line: startToken.line,
                column: startToken.column
            };
        }

        // Multiline note
        this.consumeNewlineOrEOF();
        const text = this.parseMultilineNoteText();

        return {
            type: 'ComponentNote',
            position,
            linkedTo: { name: target.name, isBracketed: target.isBracketed },
            text,
            line: startToken.line,
            column: startToken.column
        };
    }

    private parseMultilineNoteText(): string {
        const lines: string[] = [];
        while (!this.isAtEnd()) {
            const token = this.peek();
            if (
                (token.type === TokenType.END || (token.type === TokenType.IDENTIFIER && token.value.toLowerCase() === 'end')) &&
                (this.peekNext().type === TokenType.NOTE || this.peekNext().value.toLowerCase() === 'note')
            ) {
                this.advance(); // consume 'end'
                this.advance(); // consume 'note'
                break;
            }

            // Read the entire line as a single string
            let lineStr = '';
            while (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
                lineStr += (lineStr ? ' ' : '') + this.advance().value;
            }
            lines.push(lineStr);
            this.consumeNewlineOrEOF();
        }
        return lines.join('\n');
    }

    private parseMultilineDescription(): string {
        const lines: string[] = [];
        while (!this.isAtEnd()) {
            const token = this.peek();
            if (token.type === TokenType.RBRACKET) {
                this.advance(); // consume ']'
                break;
            }

            // Read the entire line as a single string
            let lineStr = '';
            while (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
                const currentToken = this.advance();
                if (currentToken.type === TokenType.RBRACKET) {
                    // Closed description inline at the end of the line
                    break;
                }
                lineStr += (lineStr ? ' ' : '') + currentToken.value;
            }
            lines.push(lineStr);
            if (this.previous().type === TokenType.RBRACKET) {
                // If the loop stopped due to RBRACKET, we finished
                break;
            }
            this.consumeNewlineOrEOF();
        }
        return lines.join('\n').trim();
    }

    private parseLabelRestOfLine(): string {
        let label = '';
        while (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
            label += (label ? ' ' : '') + this.advance().value;
        }
        return label.trim();
    }

    // Helper operations
    private peek(): Token {
        return this.tokens[this.current];
    }

    private peekNext(): Token {
        if (this.current + 1 >= this.tokens.length) return this.tokens[this.tokens.length - 1];
        return this.tokens[this.current + 1];
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        throw this.error(this.peek(), message);
    }

    private consumeNewlineOrEOF() {
        if (this.match(TokenType.NEWLINE) || this.isAtEnd()) {
            return;
        }
        // If not a newline, we consume standard tokens until a newline to tolerate stray tokens on the same line
        while (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
            this.advance();
        }
        this.match(TokenType.NEWLINE);
    }

    private skipNewlines() {
        while (this.check(TokenType.NEWLINE)) {
            this.advance();
        }
    }

    private checkLbraceAhead(): boolean {
        let temp = this.current;
        while (temp < this.tokens.length) {
            const tok = this.tokens[temp];
            if (tok.type === TokenType.NEWLINE || tok.type === TokenType.EOF) {
                break;
            }
            if (tok.type === TokenType.LBRACE) {
                return true;
            }
            temp++;
        }
        return false;
    }

    private error(token: Token, message: string): ParseError {
        return new ParseError(
            `Component AST Parser Error at line ${token.line}, col ${token.column}: ${message} (Got: '${token.value}')`,
            token.line,
            token.column
        );
    }
}
