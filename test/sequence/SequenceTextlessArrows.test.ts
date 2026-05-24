import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { SequenceRenderer } from '../../src/diagrams/sequence/SequenceRenderer';
import { LayoutEngine } from '../../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Textless Arrows Compact Layout', () => {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();
    const layoutEngine = new LayoutEngine(defaultTheme);

    it('should assign a compact step height (20px) to text-less message arrows', () => {
        const code = `
        a->b
        a->b
        a->b
        `;
        const diagram = parser.parse(code);
        const layout = layoutEngine.calculateLayout(diagram);

        expect(layout.messages).toHaveLength(3);
        const y0 = layout.messages[0].y;
        const y1 = layout.messages[1].y;
        const y2 = layout.messages[2].y;

        // The vertical distance between steps with text-less messages should be exactly 20px
        expect(y1 - y0).toBe(20);
        expect(y2 - y1).toBe(20);

        const svg = renderer.render(diagram);
        // The SVG should not contain any empty <text> elements or text elements for message content
        // SVG text elements look like: <text ...>label</text>
        // Since there is no label and no autonumber, there shouldn't be any text element printed for messages.
        // We check that no text element is rendered for the message label.
        // There could be participant texts (e.g. "a", "b"), but no empty text tags or text tags with messages.
        const textElements = svg.match(/<text [^>]*>[^<]*<\/text>/g) || [];
        // The text elements should only be for participants "a" and "b" (drawn twice if footbox is shown)
        expect(textElements.length).toBe(4); // 2 participants * 2 (header and footer participant boxes)
        textElements.forEach(text => {
            expect(text).not.toContain('fill="#000000"'); // participant texts don't use message stroke color (which defaults to defaultStroke #333333 or line #666666)
            const content = text.replace(/<text [^>]*>|<\/text>/g, '');
            expect(content === 'a' || content === 'b').toBe(true);
        });
    });

    it('should assign a compact vertical spacing (30px) to message arrows that have text labels', () => {
        const code = `
        a->b: message 1
        a->b: message 2
        a->b: message 3
        `;
        const diagram = parser.parse(code);
        const layout = layoutEngine.calculateLayout(diagram);

        expect(layout.messages).toHaveLength(3);
        const y0 = layout.messages[0].y;
        const y1 = layout.messages[1].y;
        const y2 = layout.messages[2].y;

        // The vertical distance between steps with labeled messages should be exactly 30px (20px label + 10px margin)
        expect(y1 - y0).toBe(30);
        expect(y2 - y1).toBe(30);
    });

    it('should support mixed sequence diagrams where text-less arrows following labeled arrows have a narrow 20px gap', () => {
        const code = `
        a->b: Hello
        a->b
        a->b
        `;
        const diagram = parser.parse(code);
        const layout = layoutEngine.calculateLayout(diagram);

        expect(layout.messages).toHaveLength(3);
        const y0 = layout.messages[0].y;
        const y1 = layout.messages[1].y;
        const y2 = layout.messages[2].y;

        // Step 1 has NO text and follows a step with text: it should take compact spacing (20px)
        expect(y1 - y0).toBe(20);

        // Step 2 has NO text and follows a step with NO text: it should take compact spacing (20px)
        expect(y2 - y1).toBe(20);
    });

    it('should parse message text correctly when there is no space after the colon', () => {
        const code = `
        a->b:message
        `;
        const diagram = parser.parse(code);
        expect(diagram.messages).toHaveLength(1);
        expect(diagram.messages[0].text).toBe('message');
    });
});
