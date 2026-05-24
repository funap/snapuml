import { Token, TokenType } from '../../../core/parser/Token';
import {
    SequenceDiagramAST,
    SequenceASTNode,
    ParticipantDeclAST,
    MessageAST,
    NoteAST,
    GroupAST,
    GroupSectionAST,
    DividerAST,
    DelayAST,
    SpacingAST,
    AutonumberAST,
    AutoactivateAST,
    ActivationAST,
    CreateAST,
    DestroyAST,
    ReferenceAST,
    TimeConstraintAST,
    MetaAST
} from './SequenceAST';

export class SequenceASTParser {
    private tokens: Token[];
    private current = 0;
    private sourceLines: string[];

    constructor(tokens: Token[], source: string = '') {
        this.tokens = tokens;
        this.sourceLines = source.split('\n');
    }

    parse(): SequenceDiagramAST {
        const body: SequenceASTNode[] = [];
        const startToken = this.peek();

        while (!this.isAtEnd()) {
            const statement = this.parseLineStatement();
            if (statement) {
                body.push(statement);
            }
        }

        return {
            type: 'SequenceDiagram',
            body,
            line: startToken.line,
            column: startToken.column
        };
    }

    private parseLineStatement(): SequenceASTNode | null {
        // Skip empty newlines
        while (this.match(TokenType.NEWLINE)) {
            // Do nothing
        }

        if (this.isAtEnd()) return null;

        // Save starting point of the statement
        const statementStart = this.current;

        // Check if there is a tag prefix at the start, e.g. {tag}
        let tag: string | undefined = undefined;
        if (this.check(TokenType.IDENTIFIER) && this.peek().value.startsWith('{')) {
            const tagToken = this.advance();
            tag = tagToken.value.replace(/[{}]/g, ''); // strip braces

            // If the next token is '<->', it is a time constraint!
            if (this.check(TokenType.ARROW) && (this.peek().value === '<->' || this.peek().value.includes('<->'))) {
                this.advance(); // consume <->
                const endTagToken = this.consumeIdentifier("Time constraint expects target tag after <->");
                const endTag = endTagToken.value.replace(/[{}]/g, '');

                let label = '';
                if (this.match(TokenType.COLON)) {
                    label = this.consumeLineText();
                } else {
                    this.consumeLineEnd();
                }

                return {
                    type: 'TimeConstraint',
                    startTag: tag,
                    endTag,
                    label,
                    line: tagToken.line,
                    column: tagToken.column
                };
            }
        }

        // Check for sameStep '/' or '&' prefix
        let isSameStep = false;
        if (this.check(TokenType.IDENTIFIER) && (this.peek().value === '/' || this.peek().value === '&')) {
            this.advance(); // consume '/' or '&'
            isSameStep = true;
            // The modifier modifies the NEXT statement. We just record it and continue parsing.
        }

        const token = this.peek();

        // 1. Spacing: SPACING token
        if (this.match(TokenType.SPACING)) {
            const val = this.previous().value;
            let height = 30;
            const match = val.match(/^\|\|(\d+)\|\|$/);
            if (match) {
                height = parseInt(match[1], 10);
            }
            this.consumeLineEnd();
            return {
                type: 'Spacing',
                height,
                line: token.line,
                column: token.column
            };
        }

        // 2. Delays: DELAY token
        if (this.match(TokenType.DELAY)) {
            const val = this.previous().value;
            let text: string | undefined = undefined;
            const match = val.match(/^\.\.\.(?:\s*(.*?)\s*\.\.\.)?$/);
            if (match && match[1]) {
                text = match[1];
            }
            this.consumeLineEnd();
            return {
                type: 'Delay',
                text,
                line: token.line,
                column: token.column
            };
        }

        // 3. Dividers: DIVIDER token
        if (this.match(TokenType.DIVIDER)) {
            const val = this.previous().value;
            let label = '';
            const match = val.match(/^==\s*(.*?)\s*==$/);
            if (match && match[1]) {
                label = match[1];
            }
            this.consumeLineEnd();
            return {
                type: 'Divider',
                label,
                line: token.line,
                column: token.column
            };
        }

        // 4. Create statement
        if (this.match(TokenType.CREATE)) {
            let declType: any = undefined;
            if (this.match(
                TokenType.PARTICIPANT, TokenType.ACTOR, TokenType.BOUNDARY,
                TokenType.CONTROL, TokenType.ENTITY, TokenType.DATABASE, TokenType.COLLECTIONS, TokenType.QUEUE
            )) {
                declType = this.previous().value.toLowerCase();
            }
            const nameToken = this.consumeIdentifier("Expected participant name after create");
            this.consumeLineEnd();
            return {
                type: 'Create',
                name: nameToken.value,
                declType,
                line: token.line,
                column: token.column
            };
        }

        // 5. Activation statements: activate / deactivate / destroy
        if (this.match(TokenType.ACTIVATE, TokenType.DEACTIVATE, TokenType.DESTROY)) {
            const action = this.previous().type;
            const nameToken = this.consumeIdentifier("Expected name for activation/destruction");
            let color: string | undefined = undefined;
            if (this.check(TokenType.COLOR)) {
                color = this.advance().value;
            }
            this.consumeLineEnd();

            if (action === TokenType.DESTROY) {
                return {
                    type: 'Destroy',
                    name: nameToken.value,
                    line: token.line,
                    column: token.column
                };
            } else {
                return {
                    type: 'Activation',
                    action: action === TokenType.ACTIVATE ? 'activate' : 'deactivate',
                    name: nameToken.value,
                    color,
                    line: token.line,
                    column: token.column
                };
            }
        }

        // 6. Meta statements: title, header, footer, hide footbox, skinparam, mainframe, newpage
        if (this.match(TokenType.TITLE, TokenType.HEADER, TokenType.FOOTER)) {
            const metaType = this.previous().type.toLowerCase() as any;
            const text = this.consumeLineText();
            return {
                type: 'Meta',
                metaType,
                value: text,
                line: token.line,
                column: token.column
            };
        }
        if (this.match(TokenType.HIDE)) {
            this.consume(TokenType.FOOTBOX, "Expected 'footbox' after hide");
            this.consumeLineEnd();
            return {
                type: 'Meta',
                metaType: 'hide_footbox',
                line: token.line,
                column: token.column
            };
        }
        if (this.match(TokenType.SKINPARAM)) {
            const value = this.consumeLineText();
            return {
                type: 'Meta',
                metaType: 'skinparam' as any,
                value,
                line: token.line,
                column: token.column
            };
        }
        if (this.match(TokenType.MAINFRAME)) {
            const value = this.consumeLineText();
            return {
                type: 'Meta',
                metaType: 'mainframe' as any,
                value,
                line: token.line,
                column: token.column
            };
        }
        if (this.match(TokenType.NEWPAGE)) {
            const value = this.consumeLineText();
            return {
                type: 'Meta',
                metaType: 'newpage' as any,
                value,
                line: token.line,
                column: token.column
            };
        }

        // 7. Participant declarations
        const isNextArrow = this.peekNext().type === TokenType.ARROW;
        if (!isNextArrow && this.match(
            TokenType.PARTICIPANT, TokenType.ACTOR, TokenType.BOUNDARY,
            TokenType.CONTROL, TokenType.ENTITY, TokenType.DATABASE, TokenType.COLLECTIONS, TokenType.QUEUE
        )) {
            const declType = this.previous().value.toLowerCase() as any;
            const nameToken = this.consumeIdentifier("Expected participant name");

            // Check if it's a multiline declaration starting with '['
            if (this.match(TokenType.LBRACKET)) {
                const lines: string[] = [];
                while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
                    lines.push(this.consumeLineRawText());
                }
                if (this.check(TokenType.RBRACKET)) {
                    this.advance(); // consume ']'
                }
                this.consumeLineEnd();
                return {
                    type: 'ParticipantDeclaration',
                    declType,
                    name: nameToken.value,
                    label: lines.join('\n'),
                    line: token.line,
                    column: token.column
                };
            }
            
            let label: string | undefined = undefined;
            let stereotype: string | undefined = undefined;
            let order: number | undefined = undefined;
            let color: string | undefined = undefined;

            // Parse optional modifiers
            while (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
                if (this.match(TokenType.STEREOTYPE)) {
                    stereotype = this.previous().value;
                } else if (this.match(TokenType.AS)) {
                    const labelToken = this.consumeIdentifier("Expected label after 'as'");
                    label = labelToken.value;
                } else if (this.match(TokenType.ORDER)) {
                    const orderToken = this.consumeIdentifier("Expected order number");
                    order = parseInt(orderToken.value, 10);
                } else if (this.check(TokenType.COLOR)) {
                    color = this.advance().value;
                } else {
                    // Fallback to avoid infinite loop
                    this.advance();
                }
            }
            this.consumeLineEnd();

            return {
                type: 'ParticipantDeclaration',
                declType,
                name: nameToken.value,
                label,
                stereotype,
                order,
                color,
                line: token.line,
                column: token.column
            };
        }

        // 8. Control Flow Groups: alt, opt, loop, par, break, critical, group, partition, box
        if (this.match(
            TokenType.ALT, TokenType.OPT, TokenType.LOOP, TokenType.PAR,
            TokenType.BREAK, TokenType.CRITICAL, TokenType.GROUP, TokenType.PARTITION, TokenType.BOX
        )) {
            return this.parseGroup();
        }

        // 9. Multiline or single-line references
        if (this.match(TokenType.REF)) {
            this.consume(TokenType.OVER, "Expected 'over' after ref");
            
            const participants: string[] = [];
            participants.push(this.consumeIdentifier("Expected participant name in ref").value);
            while (this.match(TokenType.COMMA)) {
                participants.push(this.consumeIdentifier("Expected participant name after comma").value);
            }

            if (this.match(TokenType.COLON)) {
                // Single line ref
                const label = this.consumeLineText();
                return {
                    type: 'Reference',
                    participants,
                    label,
                    line: token.line,
                    column: token.column
                };
            } else {
                // Multiline ref
                this.consumeLineEnd();
                const lines: string[] = [];
                while (!this.isAtEnd()) {
                    // Check if the line starts with 'end ref'
                    if (this.check(TokenType.END) && this.peekNext().type === TokenType.REF) {
                        this.advance(); // END
                        this.advance(); // REF
                        this.consumeLineEnd();
                        break;
                    }
                    if (this.check(TokenType.END) && this.peekNext().type === TokenType.NEWLINE) {
                        // Sometimes just 'end' closes it
                        this.advance(); // END
                        this.consumeLineEnd();
                        break;
                    }
                    lines.push(this.consumeLineRawText());
                }
                return {
                    type: 'Reference',
                    participants,
                    label: lines.join('\n'),
                    line: token.line,
                    column: token.column
                };
            }
        }

        // 10. Notes: note / hnote / rnote / bnote
        if (this.match(TokenType.NOTE, TokenType.HNOTE, TokenType.RNOTE, TokenType.BNOTE)) {
            const noteKeywordToken = this.previous();
            const shapeKeyword = noteKeywordToken.type;
            let shape: 'rectangle' | 'hexagon' | 'bubble' | 'folder' = 'folder';
            if (shapeKeyword === TokenType.HNOTE) shape = 'hexagon';
            else if (shapeKeyword === TokenType.RNOTE) shape = 'rectangle';
            else if (shapeKeyword === TokenType.BNOTE) shape = 'bubble';

            let positionToken: Token;
            if (this.match(TokenType.IDENTIFIER, TokenType.LEFT, TokenType.RIGHT, TokenType.TOP, TokenType.BOTTOM, TokenType.OVER)) {
                positionToken = this.previous();
            } else {
                const token = this.peek();
                throw new Error(`Syntax error at line ${token.line}, col ${token.column}: Expected note position (left, right, over, across) (Got: ${token.type} '${token.value}')`);
            }
            const position = positionToken.value.toLowerCase() as any;

            let participants: string[] = [];
            if (this.match(TokenType.OF)) {
                participants.push(this.consumeIdentifier("Expected participant name in note").value);
                while (this.match(TokenType.COMMA)) {
                    participants.push(this.consumeIdentifier("Expected participant name after comma").value);
                }
            } else if (this.check(TokenType.IDENTIFIER) && !this.peek().value.startsWith('#') && this.peek().value !== ':') {
                // of is optional, e.g. note right Participant
                participants.push(this.advance().value);
                while (this.match(TokenType.COMMA)) {
                    participants.push(this.consumeIdentifier("Expected participant name after comma").value);
                }
            }

            let color: string | undefined = undefined;
            if (this.check(TokenType.COLOR)) {
                color = this.advance().value;
            }

            if (this.match(TokenType.COLON)) {
                // Single line note
                const text = this.consumeLineText();
                return {
                    type: 'Note',
                    position,
                    participants,
                    text,
                    shape,
                    color,
                    sameStep: isSameStep,
                    line: token.line,
                    column: token.column
                };
            } else {
                // Multiline note
                this.consumeLineEnd();
                const lines: string[] = [];
                while (!this.isAtEnd()) {
                    const next = this.peek();
                    const isEndNote = next.type === TokenType.END && this.peekNext().type === TokenType.NOTE;
                    const isEndHnote = next.type === TokenType.END && this.peekNext().type === TokenType.HNOTE;
                    const isEndRnote = next.type === TokenType.END && this.peekNext().type === TokenType.RNOTE;
                    const isEndBnote = next.type === TokenType.END && this.peekNext().type === TokenType.BNOTE;

                    // Support endhnote or endnote without space
                    const isEndPlain = next.type === TokenType.END && (
                        this.peekNext().value === 'hnote' || 
                        this.peekNext().value === 'rnote' || 
                        this.peekNext().value === 'bnote' ||
                        this.peekNext().value === 'note'
                    );

                    if (isEndNote || isEndHnote || isEndRnote || isEndBnote || isEndPlain) {
                        this.advance(); // END
                        this.advance(); // NOTE/HNOTE...
                        this.consumeLineEnd();
                        break;
                    }
                    if (next.type === TokenType.END && this.peekNext().type === TokenType.NEWLINE) {
                        // Fallback just 'end'
                        this.advance(); // END
                        this.consumeLineEnd();
                        break;
                    }

                    lines.push(this.consumeLineRawText());
                }

                return {
                    type: 'Note',
                    position,
                    participants,
                    text: lines.join('\n'),
                    shape,
                    color,
                    sameStep: isSameStep,
                    line: token.line,
                    column: token.column
                };
            }
        }

        // 11. Return statement
        if (this.match(TokenType.RETURN)) {
            let text = '';
            if (this.match(TokenType.COLON)) {
                text = this.consumeLineText();
            } else {
                text = this.consumeLineText(); // In return, colon is optional
            }
            return {
                type: 'Message',
                from: '', // compiler will resolve to last active
                to: '',
                arrow: '<--', // compiler will handle return arrow
                text,
                line: token.line,
                column: token.column
            };
        }

        // 12. Autonumber settings
        if (this.match(TokenType.AUTONUMBER)) {
            if (this.match(TokenType.STOP)) {
                this.consumeLineEnd();
                return {
                    type: 'Autonumber',
                    action: 'stop',
                    line: token.line,
                    column: token.column
                };
            }
            if (this.match(TokenType.RESUME)) {
                let increment: number | undefined = undefined;
                let format: string | undefined = undefined;
                if (this.check(TokenType.IDENTIFIER)) {
                    const nextVal = this.peek().value;
                    if (/^\d+$/.test(nextVal)) {
                        increment = parseInt(this.advance().value, 10);
                    }
                }
                if (this.check(TokenType.IDENTIFIER)) {
                    format = this.advance().value;
                }
                this.consumeLineEnd();
                return {
                    type: 'Autonumber',
                    action: 'resume',
                    increment,
                    format,
                    line: token.line,
                    column: token.column
                };
            }
            if (this.match(TokenType.INC)) {
                const levelToken = this.consumeIdentifier("Expected level A, B after inc");
                this.consumeLineEnd();
                return {
                    type: 'Autonumber',
                    action: 'inc',
                    level: levelToken.value,
                    line: token.line,
                    column: token.column
                };
            }

            // Start autonumber
            let start: number | string | undefined = undefined;
            let increment: number | undefined = undefined;
            let format: string | undefined = undefined;

            if (this.check(TokenType.IDENTIFIER)) {
                const nextVal = this.peek().value;
                if (/^[\d.]+$/.test(nextVal)) {
                    start = this.advance().value; // start can be numeric or hierarchical like 1.1
                    
                    if (this.check(TokenType.IDENTIFIER)) {
                        const nextVal2 = this.peek().value;
                        if (/^\d+$/.test(nextVal2)) {
                            increment = parseInt(this.advance().value, 10);
                        }
                    }
                }
            }
            if (this.check(TokenType.IDENTIFIER)) {
                format = this.advance().value;
            }
            this.consumeLineEnd();

            return {
                type: 'Autonumber',
                action: 'start',
                start,
                increment,
                format,
                line: token.line,
                column: token.column
            };
        }

        // 13. Autoactivate setting
        if (this.match(TokenType.AUTOACTIVATE)) {
            const stateToken = this.consumeIdentifier("Expected 'on' or 'off' for autoactivate");
            const enabled = stateToken.value.toLowerCase() === 'on';
            this.consumeLineEnd();
            return {
                type: 'Autoactivate',
                enabled,
                line: token.line,
                column: token.column
            };
        }

        // 14. Message arrow matching (Default fallback if not keywords)
        // Format: [Sender] ARROW [Receiver] [Shorthand] [Color] : [Text]
        // E.g. A -> B : Text
        // E.g. [ -> A : Text
        let fromNode = '';
        if (this.check(TokenType.LBRACKET)) {
            this.advance(); // consume [
            fromNode = '[';
        } else if (this.check(TokenType.RBRACKET)) {
            this.advance(); // consume ]
            fromNode = ']';
        } else if (this.check(TokenType.ARROW)) {
            // E.g. -> A : Text (from is empty or outside)
            fromNode = '[';
        } else if (!this.isAtEnd() && this.peek().type !== TokenType.NEWLINE) {
            fromNode = this.advance().value;
        }

        const arrowToken = this.consume(TokenType.ARROW, "Expected message arrow");

        let toNode = '';
        if (this.check(TokenType.LBRACKET)) {
            this.advance(); // consume [
            toNode = '[';
        } else if (this.check(TokenType.RBRACKET)) {
            this.advance(); // consume ]
            toNode = ']';
        } else if (!this.isAtEnd() && this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.COLON && this.peek().type !== TokenType.COLOR && this.peek().type !== TokenType.SHORTHAND) {
            toNode = this.advance().value;
        } else {
            // lost message: A ->x
            toNode = ']';
        }

        let shorthand: string | undefined = undefined;
        if (this.match(TokenType.SHORTHAND)) {
            shorthand = this.previous().value;
        }

        let color: string | undefined = undefined;
        if (this.check(TokenType.COLOR)) {
            color = this.advance().value;
        }

        let text = '';
        if (this.match(TokenType.COLON)) {
            text = this.consumeLineText();
        } else {
            this.consumeLineEnd();
        }

        const msgNode: MessageAST = {
            type: 'Message',
            tag,
            from: fromNode,
            to: toNode,
            arrow: arrowToken.value,
            text,
            shorthand,
            color,
            line: token.line,
            column: token.column
        };

        if (isSameStep) {
            // Apply sameStep modifier: we can represent this by prepending '/' to the arrow string
            msgNode.arrow = '/' + msgNode.arrow;
        }

        return msgNode;
    }

    private parseGroup(): GroupAST {
        const startToken = this.previous();
        const groupType = startToken.value.toLowerCase() as any;

        // Use consumeLineText to capture multi-word labels
        let label = this.consumeLineText();

        const body: SequenceASTNode[] = [];
        const sections: GroupSectionAST[] = [];

        // Pre-skip newlines before lookahead checks
        while (this.match(TokenType.NEWLINE)) {}

        while (!this.check(TokenType.END) && !this.check(TokenType.ELSE) && !this.isAtEnd()) {
            const statement = this.parseLineStatement();
            if (statement) body.push(statement);
            
            // Post-skip newlines to expose 'end' or 'else' tokens correctly
            while (this.match(TokenType.NEWLINE)) {}
        }

        while (this.match(TokenType.ELSE)) {
            const elseToken = this.previous();
            // Use consumeLineText to capture multi-word else labels
            let sectionLabel = this.consumeLineText();

            const sectionBody: SequenceASTNode[] = [];
            
            while (this.match(TokenType.NEWLINE)) {}

            while (!this.check(TokenType.END) && !this.check(TokenType.ELSE) && !this.isAtEnd()) {
                const statement = this.parseLineStatement();
                if (statement) sectionBody.push(statement);
                
                while (this.match(TokenType.NEWLINE)) {}
            }

            sections.push({
                type: 'GroupSection',
                label: sectionLabel,
                body: sectionBody,
                line: elseToken.line,
                column: elseToken.column
            });
        }

        this.consume(TokenType.END, "Expected 'end' at the end of control group");
        
        // Cleanly consume trailing 'box' for 'end box'
        if (groupType === 'box' && this.check(TokenType.BOX)) {
            this.advance();
        }
        
        this.consumeLineEnd();

        return {
            type: 'Group',
            groupType,
            label,
            body,
            sections,
            line: startToken.line,
            column: startToken.column
        };
    }

    private peek(): Token {
        return this.tokens[this.current];
    }

    private peekNext(): Token {
        if (this.current + 1 >= this.tokens.length) return this.peek();
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
        const token = this.peek();
        throw new Error(`Syntax error at line ${token.line}, col ${token.column}: ${message} (Got: ${token.type} '${token.value}')`);
    }

    private consumeLineEnd() {
        if (this.isAtEnd()) return;
        const currentLine = this.peek().line;
        while (!this.isAtEnd() && this.peek().line === currentLine) {
            const token = this.advance();
            if (token.type === TokenType.NEWLINE) break;
        }
    }

    private consumeLineText(): string {
        if (this.isAtEnd() || this.check(TokenType.NEWLINE)) {
            this.consumeLineEnd();
            return '';
        }
        const token = this.peek();
        const rawLine = this.sourceLines[token.line - 1] || '';
        let startIdx = token.column - 1;

        // If the previous token was a COLON on the same line, we must not backtrack past it
        let minStartIdx = 0;
        if (this.current > 0 && this.tokens[this.current - 1].type === TokenType.COLON) {
            const colonToken = this.tokens[this.current - 1];
            if (colonToken.line === token.line) {
                minStartIdx = colonToken.column; // column is 1-based, which represents index after colon
            }
        }

        while (startIdx > minStartIdx && rawLine[startIdx] !== '"' && rawLine[startIdx - 1] !== ' ' && rawLine[startIdx - 1] !== '\t') {
            startIdx--;
        }
        if (startIdx > minStartIdx && rawLine[startIdx - 1] === '"') {
            startIdx--;
        }
        const text = rawLine.substring(startIdx).trim();
        this.consumeLineEnd();
        return text;
    }

    private consumeLineRawText(): string {
        if (this.isAtEnd()) {
            return '';
        }
        const token = this.peek();
        const rawLine = this.sourceLines[token.line - 1] || '';
        this.consumeLineEnd();
        return rawLine;
    }

    private consumeIdentifier(message: string): Token {
        if (this.check(TokenType.IDENTIFIER)) return this.advance();
        // Allow keyword tokens to be treated as identifiers when expected as identifier
        const nextType = this.peek().type;
        if (nextType !== TokenType.EOF && nextType !== TokenType.NEWLINE && nextType !== TokenType.COLON && nextType !== TokenType.ARROW) {
            return this.advance();
        }
        const token = this.peek();
        throw new Error(`Syntax error at line ${token.line}, col ${token.column}: ${message} (Got: ${token.type} '${token.value}')`);
    }
}
