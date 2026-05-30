import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { SequenceRenderer } from '../../src/diagrams/sequence/SequenceRenderer';
import { LayoutEngine } from '../../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Participant Stereotype and Spot support', () => {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();
    const layoutEngine = new LayoutEngine(defaultTheme);

    it('should parse, compile, and layout participant with stereotype correctly', () => {
        const code = `
        participant "Famous Bob" as Bob << Generated >>
        participant Alice << (C,#ADD1B2) Testable >>
        Bob -> Alice: First message
        `;
        const diagram = parser.parse(code);
        
        // Verify participants list contains the correct stereotype values
        const bob = diagram.participants.find(p => p.name === 'Bob');
        const alice = diagram.participants.find(p => p.name === 'Alice');
        
        expect(bob).toBeDefined();
        expect(bob?.stereotype).toBe(' Generated ');

        expect(alice).toBeDefined();
        expect(alice?.stereotype).toBe(' (C,#ADD1B2) Testable ');

        const layout = layoutEngine.calculateLayout(diagram);
        
        // Since stereotypes are present, participant boxes should be taller (60px instead of default 40px)
        expect(layout.participants[0].height).toBe(60);
        expect(layout.participants[1].height).toBe(60);
    });

    it('should render standard stereotype text inside double angle quotes in SVG', () => {
        const code = `
        participant "Famous Bob" as Bob << Generated >>
        Bob -> Alice: First message
        `;
        const diagram = parser.parse(code);
        const svg = renderer.render(diagram);

        // Should render stereotype enclosed in « and » and with italic style
        expect(svg).toContain('«Generated»');
        expect(svg).toContain('font-style="italic"');
    });

    it('should render spot circular badge and letter in SVG when specified', () => {
        const code = `
        participant Alice << (C,#ADD1B2) Testable >>
        Alice -> Bob: First message
        `;
        const diagram = parser.parse(code);
        const svg = renderer.render(diagram);

        // 1. Should contain the circle with correct fill color
        expect(svg).toContain('fill="#ADD1B2"');
        expect(svg).toContain('<circle');

        // 2. Should contain the letter "C" inside the circle
        expect(svg).toContain('>C</text>');

        // 3. Should contain the stereotype text "Testable"
        expect(svg).toContain('«Testable»');
    });
});
