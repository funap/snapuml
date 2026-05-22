import { Token, TokenType } from './Token';

export class Lexer {
    private source: string;
    private tokens: Token[] = [];
    private line = 1;
    private column = 1;
    private current = 0;
    private lineText = '';

    constructor(source: string) {
        this.source = source;
    }

    scanTokens(): Token[] {
        const lines = this.source.split('\n');
        for (let i = 0; i < lines.length; i++) {
            this.line = i + 1;
            this.column = 1;
            this.current = 0;
            this.lineText = lines[i];

            this.scanLine();
        }

        this.addToken(TokenType.EOF, '');
        return this.tokens;
    }

    private scanLine() {
        const trimmed = this.lineText.trim();
        // Ignore empty lines, comments, and pragmas
        if (trimmed === '' || trimmed.startsWith("'") || trimmed.startsWith('@') || trimmed.startsWith('!pragma')) {
            this.addToken(TokenType.NEWLINE, '\n');
            return;
        }

        // Special line-level constructs
        // 1. Spacing: ||| or ||45||
        if (trimmed === '|||') {
            this.addToken(TokenType.SPACING, '|||');
            this.addToken(TokenType.NEWLINE, '\n');
            return;
        }
        const spacingMatch = trimmed.match(/^\|\|(\d+)\|\|$/);
        if (spacingMatch) {
            this.addToken(TokenType.SPACING, trimmed);
            this.addToken(TokenType.NEWLINE, '\n');
            return;
        }

        // 2. Delays: ... or ... label ...
        const delayMatch = trimmed.match(/^\.\.\.(?:\s*(.*?)\s*\.\.\.)?$/);
        if (delayMatch) {
            this.addToken(TokenType.DELAY, trimmed);
            this.addToken(TokenType.NEWLINE, '\n');
            return;
        }

        // 3. Dividers: == label ==
        const dividerMatch = trimmed.match(/^==\s*(.*?)\s*==$/);
        if (dividerMatch) {
            this.addToken(TokenType.DIVIDER, trimmed);
            this.addToken(TokenType.NEWLINE, '\n');
            return;
        }

        while (this.current < this.lineText.length) {
            const char = this.peek();

            // Skip whitespaces
            if (/\s/.test(char)) {
                this.advance();
                continue;
            }

            // Inline comment check
            if (char === "'") {
                // Ignore rest of line
                break;
            }

            // Stereotypes <<...>>
            if (char === '<' && this.peekNext() === '<') {
                this.scanStereotype();
                continue;
            }

            // Arrow matching (highest priority when symbol starts)
            if (char === '<' || char === '-' || char === '.' || char === 'o' || char === '/' || char === '\\') {
                if (this.tryScanArrow()) {
                    continue;
                }
            }

            // Shorthands: ++, --, ++--, --++, **, !!
            if (char === '+' || char === '-' || char === '*' || char === '!') {
                if (this.tryScanShorthand()) {
                    continue;
                }
            }

            // Single characters & punctuation
            if (char === ':') {
                this.advance();
                this.addToken(TokenType.COLON, ':');
                continue;
            }
            if (char === ',') {
                this.advance();
                this.addToken(TokenType.COMMA, ',');
                continue;
            }
            if (char === '=') {
                this.advance();
                this.addToken(TokenType.EQUAL, '=');
                continue;
            }
            if (char === '{') {
                this.scanTagOrLbrace();
                continue;
            }
            if (char === '}') {
                this.advance();
                this.addToken(TokenType.RBRACE, '}');
                continue;
            }
            if (char === '[') {
                this.scanBracketOrColor();
                continue;
            }
            if (char === ']') {
                this.advance();
                this.addToken(TokenType.RBRACKET, ']');
                continue;
            }
            if (char === '(' && this.peekNext() === ')') {
                this.advance();
                this.advance();
                this.addToken(TokenType.IDENTIFIER, '()'); // interface circle symbol
                continue;
            }

            // Color declarations starting with #
            if (char === '#') {
                this.scanColor();
                continue;
            }

            // Quoted string (Identifiers)
            if (char === '"') {
                this.scanQuotedString();
                continue;
            }

            // Alphanumeric Identifiers or Keywords
            if (/[a-zA-Z0-9_]/.test(char)) {
                this.scanWord();
                continue;
            }

            // Fallback for individual characters
            this.advance();
            this.addToken(TokenType.IDENTIFIER, char);
        }

        this.addToken(TokenType.NEWLINE, '\n');
    }

    private peek(): string {
        if (this.current >= this.lineText.length) return '\0';
        return this.lineText[this.current];
    }

    private peekNext(): string {
        if (this.current + 1 >= this.lineText.length) return '\0';
        return this.lineText[this.current + 1];
    }

    private advance(): string {
        const char = this.peek();
        this.current++;
        this.column++;
        return char;
    }

    private addToken(type: TokenType, value: string) {
        this.tokens.push({
            type,
            value,
            line: this.line,
            column: this.column - value.length
        });
    }

    private scanQuotedString() {
        this.advance(); // consume opening "
        let start = this.current;
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
        if (this.peek() === '\0') {
            throw new Error(`Quoted string not closed at line ${this.line}, col ${this.column}`);
        }
        this.advance(); // consume closing "
        this.addToken(TokenType.IDENTIFIER, value);
    }

    private scanStereotype() {
        const startCol = this.column;
        this.advance(); // <
        this.advance(); // <
        let start = this.current;
        while (!(this.peek() === '>' && this.peekNext() === '>') && this.peek() !== '\0') {
            this.advance();
        }
        if (this.peek() === '\0') {
            throw new Error(`Stereotype << not closed at line ${this.line}, col ${this.column}`);
        }
        const val = this.lineText.substring(start, this.current);
        this.advance(); // >
        this.advance(); // >
        this.tokens.push({
            type: TokenType.STEREOTYPE,
            value: val,
            line: this.line,
            column: startCol
        });
    }

    private scanTagOrLbrace() {
        const startCol = this.column;
        this.advance(); // {
        // Tag could be {tag1}
        let start = this.current;
        while (this.peek() !== '}' && this.peek() !== '\0' && !/\s/.test(this.peek())) {
            this.advance();
        }
        if (this.peek() === '}') {
            const val = this.lineText.substring(start, this.current);
            this.advance(); // }
            this.addToken(TokenType.IDENTIFIER, `{${val}}`); // represent tag as identifier for now
        } else {
            // It's a standard LBRACE '{'
            this.tokens.push({
                type: TokenType.LBRACE,
                value: '{',
                line: this.line,
                column: startCol
            });
        }
    }

    private scanBracketOrColor() {
        const startCol = this.column;
        this.advance(); // [
        // Check if color prefix like [#red]
        if (this.peek() === '#') {
            let start = this.current;
            while (this.peek() !== ']' && this.peek() !== '\0') {
                this.advance();
            }
            if (this.peek() === ']') {
                const color = this.lineText.substring(start, this.current);
                this.advance(); // ]
                this.addToken(TokenType.COLOR, color);
                return;
            }
        }
        // Otherwise just yield a standard LBRACKET
        this.tokens.push({
            type: TokenType.LBRACKET,
            value: '[',
            line: this.line,
            column: startCol
        });
    }

    private scanColor() {
        this.advance(); // #
        let start = this.current;
        while (/[a-zA-Z0-9_]/.test(this.peek())) {
            this.advance();
        }
        const color = this.lineText.substring(start, this.current);
        this.addToken(TokenType.COLOR, '#' + color);
    }

    private tryScanArrow(): boolean {
        // Test arrow matching using our regex
        const sub = this.lineText.substring(this.current);
        // The pattern for arrows:
        // Must contain at least one - or . (optionally surrounded by <, >, o, x, /, \ and [#color] and direction tags)
        const ARROW_REGEX = /^([<ox\\/]*)([-.]+)(left|right|up|down|le|ri|do)?(?:\[(#\w+)\])?([-.]*)([>ox\\/]*)?(--\+\+|\+\+--|--|\+\+|\*\*|!!)?/i;
        const match = sub.match(ARROW_REGEX);
        if (match) {
            const fullArrow = match[0];
            const hasArrowHead = /[<>xoOX\\/]/.test(fullArrow);
            const isComponentArrow = /^([-]|\.\.?)$/.test(fullArrow) || /^[-.]+(left|right|up|down|le|ri|do)[-.]*$/i.test(fullArrow);
            if (!hasArrowHead && !isComponentArrow) {
                return false;
            }
            this.current += fullArrow.length;
            this.column += fullArrow.length;
            this.addToken(TokenType.ARROW, fullArrow);
            return true;
        }
        return false;
    }

    private tryScanShorthand(): boolean {
        const sub = this.lineText.substring(this.current);
        const match = sub.match(/^(\+\+--|--\+\+|\+\+|--|\*\*|!!)/);
        if (match) {
            const val = match[1];
            this.current += val.length;
            this.column += val.length;
            this.addToken(TokenType.SHORTHAND, val);
            return true;
        }
        return false;
    }

    private tryScanArrowLookahead(): boolean {
        const sub = this.lineText.substring(this.current);
        const ARROW_REGEX = /^([<ox\\/]*)([-.]+)(?:\[(#\w+)\])?([-.]*)([>ox\\/]*)?(--\+\+|\+\+--|--|\+\+|\*\*|!!)?/i;
        const match = sub.match(ARROW_REGEX);
        if (match) {
            const fullArrow = match[0];
            if (fullArrow.includes('>') || fullArrow.includes('<') || fullArrow.length >= 2) {
                return true;
            }
        }
        return false;
    }

    private scanWord() {
        let start = this.current;
        while (/[a-zA-Z0-9_.-]/.test(this.peek())) {
            const nextChar = this.peek();
            if (nextChar === '-' || nextChar === '.') {
                if (this.tryScanArrowLookahead()) {
                    break;
                }
            }
            this.advance();
        }
        const value = this.lineText.substring(start, this.current);
        const upper = value.toUpperCase();

        if (upper in KEYWORDS) {
            this.addToken(KEYWORDS[upper], value);
        } else {
            this.addToken(TokenType.IDENTIFIER, value);
        }
    }
}

const KEYWORDS: Record<string, TokenType> = {
    PARTICIPANT: TokenType.PARTICIPANT,
    ACTOR: TokenType.ACTOR,
    BOUNDARY: TokenType.BOUNDARY,
    CONTROL: TokenType.CONTROL,
    ENTITY: TokenType.ENTITY,
    DATABASE: TokenType.DATABASE,
    COLLECTIONS: TokenType.COLLECTIONS,
    QUEUE: TokenType.QUEUE,
    COMPONENT: TokenType.COMPONENT,
    INTERFACE: TokenType.INTERFACE,
    PACKAGE: TokenType.PACKAGE,
    NODE: TokenType.NODE,
    FOLDER: TokenType.FOLDER,
    FRAME: TokenType.FRAME,
    CLOUD: TokenType.CLOUD,
    ALT: TokenType.ALT,
    ELSE: TokenType.ELSE,
    OPT: TokenType.OPT,
    LOOP: TokenType.LOOP,
    PAR: TokenType.PAR,
    BREAK: TokenType.BREAK,
    CRITICAL: TokenType.CRITICAL,
    GROUP: TokenType.GROUP,
    END: TokenType.END,
    REF: TokenType.REF,
    NOTE: TokenType.NOTE,
    HNOTE: TokenType.HNOTE,
    RNOTE: TokenType.RNOTE,
    BNOTE: TokenType.BNOTE,
    CREATE: TokenType.CREATE,
    DESTROY: TokenType.DESTROY,
    ACTIVATE: TokenType.ACTIVATE,
    DEACTIVATE: TokenType.DEACTIVATE,
    RETURN: TokenType.RETURN,
    TITLE: TokenType.TITLE,
    HEADER: TokenType.HEADER,
    FOOTER: TokenType.FOOTER,
    AUTONUMBER: TokenType.AUTONUMBER,
    AUTOACTIVATE: TokenType.AUTOACTIVATE,
    HIDE: TokenType.HIDE,
    FOOTBOX: TokenType.FOOTBOX,
    AS: TokenType.AS,
    ORDER: TokenType.ORDER,
    OF: TokenType.OF,
    OVER: TokenType.OVER,
    ON: TokenType.ON,
    OFF: TokenType.OFF,
    STOP: TokenType.STOP,
    RESUME: TokenType.RESUME,
    INC: TokenType.INC,
    PORT: TokenType.PORT,
    PORTIN: TokenType.PORTIN,
    PORTOUT: TokenType.PORTOUT,
    LEFT: TokenType.LEFT,
    RIGHT: TokenType.RIGHT,
    TOP: TokenType.TOP,
    BOTTOM: TokenType.BOTTOM,
};
