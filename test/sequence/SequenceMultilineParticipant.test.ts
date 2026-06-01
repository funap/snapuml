import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { SequenceRenderer } from '../../src/diagrams/sequence/SequenceRenderer';
import { LayoutEngine } from '../../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Multiline Participant Declarations', () => {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();
    const layoutEngine = new LayoutEngine(defaultTheme);

    it('should parse, compile, and layout multiline participant correctly', () => {
        const code = `
        participant Participant [
            =Title
            ----
            ""SubTitle""
        ]
        participant Bob
        Participant -> Bob: hello
        `;
        const diagram = parser.parse(code);

        // Verify participant info
        const part = diagram.participants.find(p => p.name === 'Participant');
        expect(part).toBeDefined();
        expect(part?.label).toContain('Title');
        expect(part?.label).toContain('SubTitle');
        expect(part?.name).toBe('Participant');

        const layout = layoutEngine.calculateLayout(diagram);
        
        // Multiline participant should be taller than default (40px)
        const partLayout = layout.participants.find(pl => pl.participant.name === 'Participant')!;
        expect(partLayout.height).toBeGreaterThan(40);

        // Render to SVG
        const svg = renderer.render(diagram);
        expect(svg).toContain('Title');
        expect(svg).not.toContain('=Title'); // Leading `=` should be parsed and stripped
        expect(svg).toContain('SubTitle');
        
        // Horizontal divider line should be rendered
        expect(svg).toContain('<line x1=');

        // Monospace subtitle should be formatted in SVG
        expect(svg).toContain('font-family="monospace"');
    });
});
