import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { SequenceRenderer } from '../../src/diagrams/sequence/SequenceRenderer';

describe('Sequence Diagram Delay Styles', () => {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();

    it('should parse and render default space delay style', () => {
        const code = `
        participant A
        participant B
        A -> B: msg
        ...
        A -> B: retry
        `;
        const diagram = parser.parse(code);
        expect(diagram.delayStyle).toBe('space');

        const svg = renderer.render(diagram);
        // Under space style, there should be NO circle elements for the horizontal dots
        expect(svg).not.toContain('r="1.5"');
    });

    it('should support skinparam sequenceDelayStyle dots spanning from leftmost to rightmost lifelines', () => {
        const code = `
        skinparam sequenceDelayStyle dots
        participant A
        participant B
        A -> B: msg
        ...
        A -> B: retry
        `;
        const diagram = parser.parse(code);
        expect(diagram.delayStyle).toBe('dots');

        const svg = renderer.render(diagram);
        // The dots style should contain circle elements for the horizontal dots
        expect(svg).toContain('r="1.5"');
        // It shouldn't contain a masking rectangle since it's dots mode
        expect(svg).not.toContain('width="4" height="30" fill="white" />');
    });

    it('should support skinparam sequenceDelayStyle lifeline', () => {
        const code = `
        skinparam sequenceDelayStyle lifeline
        participant A
        participant B
        A -> B: msg
        ...
        A -> B: retry
        `;
        const diagram = parser.parse(code);
        expect(diagram.delayStyle).toBe('lifeline');

        const svg = renderer.render(diagram);
        // Under lifeline style, there should be white masking rectangles and circles for the lifelines
        expect(svg).toContain('fill="white"');
        expect(svg).toContain('<circle cx="');
    });
});
