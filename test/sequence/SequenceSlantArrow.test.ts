import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { LayoutEngine } from '../../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Slant Arrows', () => {
    it('should parse and compile slant arrow delay syntax', () => {
        const parser = new SequenceParser();
        const content = `
            A ->(10) B: text 10
            B ->(15) A: text 15
            A (20)<- B: text 20
        `;
        const diagram = parser.parse(content);

        expect(diagram.messages).toHaveLength(3);

        const msg1 = diagram.messages[0];
        expect(msg1.from).toBe('A');
        expect(msg1.to).toBe('B');
        expect(msg1.arrowDelay).toBe(10);
        expect(msg1.arrowHead).toBe('default');

        const msg2 = diagram.messages[1];
        expect(msg2.from).toBe('B');
        expect(msg2.to).toBe('A');
        expect(msg2.arrowDelay).toBe(15);
        expect(msg2.arrowHead).toBe('default');

        const msg3 = diagram.messages[2];
        expect(msg3.from).toBe('A');
        expect(msg3.to).toBe('B');
        expect(msg3.arrowDelay).toBe(20);
        expect(msg3.arrowHead).toBe('none');
        expect(msg3.startHead).toBe('default');
    });

    it('should layout slant arrows with vertical Y-axis offsets', () => {
        const parser = new SequenceParser();
        const layoutEngine = new LayoutEngine(defaultTheme);

        // 1. Forward direction slant arrow
        const contentForward = `
            A ->(30) B: hello
        `;
        const diagramForward = parser.parse(contentForward);
        const layoutForward = layoutEngine.calculateLayout(diagramForward);

        expect(layoutForward.messages).toHaveLength(1);
        const mlForward = layoutForward.messages[0];

        // Slant arrow endpoints should have a difference equal to the delay (30px)
        const pf1 = mlForward.points[0];
        const pf2 = mlForward.points[1];
        expect(pf2.y - pf1.y).toBe(30); // B (right endpoint) is lower than A

        // Label position should be positioned at the midpoint vertically
        expect(mlForward.labelPosition.y).toBe(pf1.y + 15);

        // 2. Reverse direction slant arrow
        const contentReverse = `
            A (30)<- B: hello
        `;
        const diagramReverse = parser.parse(contentReverse);
        const layoutReverse = layoutEngine.calculateLayout(diagramReverse);

        expect(layoutReverse.messages).toHaveLength(1);
        const mlReverse = layoutReverse.messages[0];

        // Slant arrow endpoints should have a difference equal to the delay (30px)
        const pr1 = mlReverse.points[0];
        const pr2 = mlReverse.points[1];
        expect(pr1.y - pr2.y).toBe(30); // A (left endpoint) is lower than B (slanting down to the left)

        // Label position should be positioned at the midpoint vertically
        expect(mlReverse.labelPosition.y).toBe(pr2.y + 15);
    });

    it('should allocate extra vertical space in step heights for slant arrows', () => {
        const parser = new SequenceParser();
        const layoutEngine = new LayoutEngine(defaultTheme);

        // 1. Without slant delay
        const contentNormal = `
            A -> B: hello
            A -> B: world
        `;
        const diagNormal = parser.parse(contentNormal);
        const layoutNormal = layoutEngine.calculateLayout(diagNormal);

        // 2. With slant delay on first message
        const contentSlant = `
            A ->(50) B: hello
            A -> B: world
        `;
        const diagSlant = parser.parse(contentSlant);
        const layoutSlant = layoutEngine.calculateLayout(diagSlant);

        // The second message in layoutSlant should be pushed further down because of the 50px delay on the first step
        const firstMsgYNormal = layoutNormal.messages[0].y;
        const secondMsgYNormal = layoutNormal.messages[1].y;
        const normalDiff = secondMsgYNormal - firstMsgYNormal;

        const firstMsgYSlant = layoutSlant.messages[0].y;
        const secondMsgYSlant = layoutSlant.messages[1].y;
        const slantDiff = secondMsgYSlant - firstMsgYSlant;

        // The step height for the first step with the 50px delay should be larger, expanding the gap
        expect(slantDiff).toBeGreaterThan(normalDiff);
        expect(slantDiff).toBe(80);
    });

    it('should support slant delay in self-messages', () => {
        const parser = new SequenceParser();
        const layoutEngine = new LayoutEngine(defaultTheme);

        const content = `
            A ->(20) A: self hello
        `;
        const diagram = parser.parse(content);
        const layout = layoutEngine.calculateLayout(diagram);

        expect(layout.messages).toHaveLength(1);
        const ml = layout.messages[0];

        // Self-message has 4 points
        expect(ml.points).toHaveLength(4);
        const p0 = ml.points[0];
        const p1 = ml.points[1];
        const p2 = ml.points[2];
        const p3 = ml.points[3];

        // Start point is y
        expect(p0.y).toBe(ml.y);
        expect(p1.y).toBe(ml.y);

        // End points should be at y + 25 + delay
        expect(p2.y).toBe(ml.y + 25 + 20);
        expect(p3.y).toBe(ml.y + 25 + 20);

        // Midpoint of the text label
        expect(ml.labelPosition.y).toBe(ml.y + 10 + 10);
    });
});
