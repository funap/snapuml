import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { SequenceRenderer } from '../../src/diagrams/sequence/SequenceRenderer';
import { Lexer } from '../../src/core/parser/Lexer';
import { SequenceASTParser } from '../../src/diagrams/sequence/parser/SequenceASTParser';
import { GroupAST } from '../../src/diagrams/sequence/parser/SequenceAST';

describe('Sequence Diagram Group and Else Branch Colors', () => {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();

    it('should parse, compile, and render header and body background colors for alt groups and else sections', () => {
        const code = `
        Alice -> Bob: Authentication Request
        alt#Gold #LightBlue Successful case
            Bob -> Alice: Authentication Accepted
        else #Pink Failure
            Bob -> Alice: Authentication Rejected
        end
        `;

        // 1. Test Lexer & AST Parser
        const lexer = new Lexer(code);
        const tokens = lexer.scanTokens();
        const astParser = new SequenceASTParser(tokens, code);
        const ast = astParser.parse();

        const groupASTNode = ast.body.find(node => node.type === 'Group') as GroupAST;
        expect(groupASTNode).toBeDefined();
        expect(groupASTNode.groupType).toBe('alt');
        expect(groupASTNode.headerColor).toBe('#Gold');
        expect(groupASTNode.bodyColor).toBe('#LightBlue');
        expect(groupASTNode.label).toBe('Successful case');

        expect(groupASTNode.sections).toHaveLength(1);
        expect(groupASTNode.sections[0].color).toBe('#Pink');
        expect(groupASTNode.sections[0].label).toBe('Failure');

        // 2. Test Compilation
        const diagram = parser.parse(code);
        expect(diagram.groups).toHaveLength(1);
        const group = diagram.groups[0];
        expect(group.type).toBe('alt');
        expect(group.headerColor).toBe('#Gold');
        expect(group.color).toBe('#LightBlue');
        expect(group.label).toBe('Successful case');
        
        expect(group.sections).toHaveLength(1);
        expect(group.sections[0].color).toBe('#Pink');
        expect(group.sections[0].label).toBe('Failure');

        // 3. Test Rendering (SVG Output)
        const svg = renderer.render(diagram);

        // Verify clip path elements
        expect(svg).toContain('<clipPath id="group-clip-');
        expect(svg).toContain('rx="5"');

        // Verify group backgrounds inside clipped container
        // Note: the colors might be substringed by normalizeColor to Gold, LightBlue, Pink or remain hex.
        // Let's verify normalized colors.
        expect(svg).toContain('fill="LightBlue"');
        expect(svg).toContain('fill="Pink"');

        // Verify header tab background
        expect(svg).toContain('fill="Gold"');

        // Verify section labels
        expect(svg).toContain('[Successful case]');
        expect(svg).toContain('[Failure]');
    });

    it('should support single color body background default, and parse correctly', () => {
        const code = `
        alt #LightBlue Successful case
            Bob -> Alice: Accepted
        else
            Bob -> Alice: Rejected
        end
        `;

        const lexer = new Lexer(code);
        const tokens = lexer.scanTokens();
        const astParser = new SequenceASTParser(tokens, code);
        const ast = astParser.parse();

        const groupASTNode = ast.body.find(node => node.type === 'Group') as GroupAST;
        expect(groupASTNode).toBeDefined();
        expect(groupASTNode.headerColor).toBeUndefined();
        expect(groupASTNode.bodyColor).toBe('#LightBlue');
        expect(groupASTNode.label).toBe('Successful case');
    });
});
