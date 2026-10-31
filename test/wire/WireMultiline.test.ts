import { describe, it, expect } from 'vitest';
import { WireParser } from '../../src/diagrams/wire/WireParser';
import { WireLayout } from '../../src/diagrams/wire/WireLayout';
import { WireRenderer } from '../../src/diagrams/wire/WireRenderer';
import { getTextWidth } from '../../src/core/RichText';

describe('Wire Multiline \\n Support', () => {
    const parser = new WireParser();
    const layout = new WireLayout();
    const renderer = new WireRenderer();

    it('getTextWidth should return max line width for multiline strings', () => {
        const line1 = 'Line 1';
        const line2 = 'A much longer line 2';
        const multiline = `${line1}\\n${line2}`;
        const w1 = getTextWidth(line1, 13);
        const w2 = getTextWidth(line2, 13);
        const wm = getTextWidth(multiline, 13);

        expect(wm).toBe(Math.max(w1, w2));
    });

    it('should support \\n in callouts (adjusting height, width, and rendering multiple lines)', () => {
        const dsl = `
board MAIN {
  MCU "Main MCU" {
    width: 200px
    height: 150px
  }
  warning for MCU.bottom "Line 1\\nLine 2 (Detailed Warning)"
}`;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        expect(result.callouts.length).toBe(1);
        const callout = result.callouts[0];

        // Height should be taller than single-line (30px) for 2 lines
        expect(callout.height).toBeGreaterThan(30);

        // Render to SVG
        const svg = renderer.render(diagram);
        expect(svg).toContain('Line 1');
        expect(svg).toContain('Line 2 (Detailed Warning)');
        // Should contain tspan for multiple lines
        expect(svg).toMatch(/<tspan[^>]*>.*Line 1.*<\/tspan>/s);
        expect(svg).toMatch(/<tspan[^>]*>.*Line 2.*<\/tspan>/s);
    });

    it('should support \\n in component notes and labels', () => {
        const dsl = `
board MAIN {
  SOC "System on Chip\\n(Broadcom BCM2711)" {
    note: "Quad Cortex-A72\\n3.3V Logic Level"
  }
}`;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const comp = result.components.find(c => c.id === 'SOC')!;
        expect(comp).toBeDefined();
        // Component height should accommodate 2 label lines + 2 note lines + ID
        expect(comp.height).toBeGreaterThanOrEqual(100);

        const svg = renderer.render(diagram);
        expect(svg).toContain('System on Chip');
        expect(svg).toContain('(Broadcom BCM2711)');
        expect(svg).toContain('Quad Cortex-A72');
        expect(svg).toContain('3.3V Logic Level');
    });

    it('should support \\n in wire notes', () => {
        const dsl = `
MCU.right -> SENSOR.left : i2c [note: "Pullup: 4.7kΩ\\nSpeed: 400kHz"]
`;
        const diagram = parser.parse(dsl);
        const svg = renderer.render(diagram);

        expect(svg).toContain('Pullup: 4.7kΩ');
        expect(svg).toContain('Speed: 400kHz');
    });
});
