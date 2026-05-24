import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { LayoutEngine } from '../../src/diagrams/sequence/SequenceLayout';
import { SequenceRenderer } from '../../src/diagrams/sequence/SequenceRenderer';
import { defaultTheme } from '../../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Box Rendering', () => {
    it('should parse box with label and color', () => {
        const parser = new SequenceParser();
        const content = `
            box "Internal Service" #LightBlue
            participant Bob
            participant Alice
            end box
        `;
        const diagram = parser.parse(content);

        expect(diagram.groups).toHaveLength(1);
        const group = diagram.groups[0];
        expect(group.type).toBe('box');
        expect(group.label).toBe('Internal Service');
        expect(group.color).toBe('#LightBlue');
        expect(group.participants).toContain('Bob');
        expect(group.participants).toContain('Alice');
    });

    it('should parse box with only color', () => {
        const parser = new SequenceParser();
        const content = `
            box #Red
            participant Bob
            end box
        `;
        const diagram = parser.parse(content);

        expect(diagram.groups).toHaveLength(1);
        const group = diagram.groups[0];
        expect(group.type).toBe('box');
        expect(group.label).toBe('');
        expect(group.color).toBe('#Red');
        expect(group.participants).toContain('Bob');
    });

    it('should parse box with only label', () => {
        const parser = new SequenceParser();
        const content = `
            box "Only Label"
            participant Bob
            end box
        `;
        const diagram = parser.parse(content);

        expect(diagram.groups).toHaveLength(1);
        const group = diagram.groups[0];
        expect(group.type).toBe('box');
        expect(group.label).toBe('Only Label');
        expect(group.color).toBeUndefined();
    });

    it('should layout box to span full vertical height and adjust participantYStart', () => {
        const parser = new SequenceParser();
        const layoutEngine = new LayoutEngine(defaultTheme);

        // 1. Without box (or box with no label)
        const contentNoLabel = `
            box
            participant Bob
            participant Alice
            end box
            Bob -> Alice : hello
        `;
        const diagNoLabel = parser.parse(contentNoLabel);
        const layoutNoLabel = layoutEngine.calculateLayout(diagNoLabel);

        // 2. With box with label
        const contentWithLabel = `
            box "Internal" #LightBlue
            participant Bob
            participant Alice
            end box
            Bob -> Alice : hello
        `;
        const diagWithLabel = parser.parse(contentWithLabel);
        const layoutWithLabel = layoutEngine.calculateLayout(diagWithLabel);

        // The vertical offset for participant headers should be pushed down by 25px when a box label exists
        expect(layoutWithLabel.participants[0].y).toBe(layoutNoLabel.participants[0].y + 25);

        // Verify the box layout bounds
        const boxLayout = layoutWithLabel.groups[0];
        expect(boxLayout.type).toBe('box');
        
        // yStart of box should be shifted up to participantYStart - 35
        const expectedY = layoutWithLabel.participants[0].y - 35;
        expect(boxLayout.y).toBe(expectedY);

        // Height should span to bottom of lifelines
        const expectedHeight = (layoutWithLabel.height - defaultTheme.padding - 10) - expectedY;
        expect(boxLayout.height).toBe(expectedHeight);
    });

    it('should render box behind lifelines and activations in SVG', () => {
        const parser = new SequenceParser();
        const renderer = new SequenceRenderer();
        const content = `
            box "Service A" #LightBlue
            participant Bob
            participant Alice
            end box
            Bob -> Alice : hello
        `;
        const diagram = parser.parse(content);
        const svg = renderer.render(diagram);

        // 1. Box background should exist in SVG with custom color and rounded corners
        expect(svg).toContain('fill="LightBlue"');
        expect(svg).toContain('stroke="#D1D1D6"');
        expect(svg).toContain('rx="8"');

        // 2. Box label should be centered and bold
        expect(svg).toContain('>Service A</text>');

        // 3. SVG rendering order: Boxes must be rendered BEFORE lifelines and activations
        const boxIndex = svg.indexOf('fill="LightBlue"');
        const lifelineIndex = svg.indexOf('stroke-dasharray="4"'); // lifeline stroke-dasharray
        expect(boxIndex).toBeGreaterThan(-1);
        expect(lifelineIndex).toBeGreaterThan(-1);
        expect(boxIndex).toBeLessThan(lifelineIndex);
    });

    it('should not introduce large empty spacing above messages when a box is used', () => {
        const parser = new SequenceParser();
        const content = `
            box "Internal Service" #LightBlue
            participant Bob
            participant Alice
            end box
            participant Other

            Bob -> Alice : hello
            Alice -> Other : goodbye
        `;
        const diagram = parser.parse(content);
        const layoutEngine = new LayoutEngine(defaultTheme);
        const layout = layoutEngine.calculateLayout(diagram);

        expect(diagram.messages).toHaveLength(2);
        // Verify that the first message starts at step 0
        expect(diagram.messages[0].step).toBe(0);
        // Verify that the second message is at step 1
        expect(diagram.messages[1].step).toBe(1);

        const y0 = layout.messages[0].y;
        const y1 = layout.messages[1].y;

        // Message 0 and Message 1 spacing should be compacted (30px since message 1 is labeled)
        expect(y1 - y0).toBe(30);
    });
});
