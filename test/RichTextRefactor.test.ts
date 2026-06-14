
import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../src/diagrams/sequence/SequenceParser';
import { ComponentParser } from '../src/diagrams/component/ComponentParser';
import { SequenceRenderer } from '../src/diagrams/sequence/SequenceRenderer';
import { ComponentRenderer } from '../src/diagrams/component/ComponentRenderer';

describe('Rich Text Refactoring', () => {
    it('should support rich text in Sequence diagrams', () => {
        const parser = new SequenceParser();
        const renderer = new SequenceRenderer();
        const diagram = parser.parse('A -> B: **Bold** and //Italic//');
        const svg = renderer.render(diagram);

        expect(svg).toContain('font-weight="bold">Bold</tspan>');
        expect(svg).toContain('font-style="italic">Italic</tspan>');
    });

    it('should support HTML-like tags in Sequence diagrams', () => {
        const parser = new SequenceParser();
        const renderer = new SequenceRenderer();
        const diagram = parser.parse('A -> B: <b>Bold</b> and <font color="red">Red</font>');
        const svg = renderer.render(diagram);

        expect(svg).toContain('font-weight="bold">Bold</tspan>');
        expect(svg).toContain('fill="red">Red</tspan>');
    });

    it('should support rich text in Component diagrams', () => {
        const parser = new ComponentParser();
        const renderer = new ComponentRenderer();
        const diagram = parser.parse('[**Bold Comp**]');
        const svg = renderer.render(diagram);

        expect(svg).toContain('font-weight="bold">Bold Comp</tspan>');
    });

    it('should support HTML-like tags in Component diagrams', () => {
        const parser = new ComponentParser();
        const renderer = new ComponentRenderer();
        const diagram = parser.parse('component "<i>Italic Comp</i>" as C');
        const svg = renderer.render(diagram);

        expect(svg).toContain('font-style="italic">Italic Comp</tspan>');
    });

    it('should decode Unicode escapes in Sequence diagrams', () => {
        const parser = new SequenceParser();
        // Decode happens in addMessage/addNote of SequenceDiagram
        const diagram = parser.parse('A -> B: char <U+3042>');
        expect(diagram.messages[0].text).toContain('char あ');
    });

    it('should preserve **** and ---- as literal text to avoid eating password fields or dividers', () => {
        const parser = new SequenceParser();
        const renderer = new SequenceRenderer();
        const diagram = parser.parse('A -> B: text with **** and ----');
        const svg = renderer.render(diagram);

        expect(svg).toContain('****');
        expect(svg).toContain('----');
        // It should not contain empty tspans from bold or strike-through
        expect(svg).not.toContain('font-weight="bold"></tspan>');
        expect(svg).not.toContain('text-decoration="line-through"></tspan>');
    });
});
