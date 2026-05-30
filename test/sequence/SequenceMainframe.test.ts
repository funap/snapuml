import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { SequenceRenderer } from '../../src/diagrams/sequence/SequenceRenderer';

describe('Sequence Diagram Mainframe support', () => {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();

    it('should parse, compile and set the mainframe title correctly', () => {
        const code = `
        mainframe This is a **mainframe**
        Alice->Bob : Hello
        `;
        const diagram = parser.parse(code);
        expect(diagram.mainframe).toBe('This is a **mainframe**');
    });

    it('should render mainframe border, tab, rich text, and transform group in SVG', () => {
        const code = `
        mainframe This is a **mainframe**
        Alice->Bob : Hello
        `;
        const diagram = parser.parse(code);
        const svg = renderer.render(diagram);

        // 1. Should have the transform group translating the inner elements
        expect(svg).toContain('<g transform="translate(15, 35)">');

        // 2. Should have the mainframe border rectangle
        expect(svg).toContain('<rect x="8" y="8"');

        // 3. Should have the mainframe tab path
        expect(svg).toContain('<path d="M 8 8 L');

        // 4. Should contain the mainframe label with rich-text bold formatting
        expect(svg).toContain('font-weight="bold"');
        expect(svg).toContain('mainframe');
    });
});
