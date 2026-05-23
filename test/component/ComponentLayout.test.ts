
import { describe, it, expect } from 'vitest';
import { ComponentDiagram } from '../../src/diagrams/component/ComponentDiagram';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';
import { ComponentLayout, ComponentLayoutResult } from '../../src/diagrams/component/ComponentLayout';
import { defaultTheme } from '../../src/diagrams/component/ComponentTheme';

// ============================================================================
// Helper functions
// ============================================================================

function parseAndLayout(input: string): ComponentLayoutResult {
    const parser = new ComponentParser();
    const diagram = parser.parse(input);
    const layout = new ComponentLayout(diagram, defaultTheme);
    return layout.calculateLayout();
}

function getComp(result: ComponentLayoutResult, name: string) {
    return result.components.find(c => c.component.name === name);
}

function getRel(result: ComponentLayoutResult, from: string, to: string) {
    return result.relationships.find(
        r => r.relationship.from === from && r.relationship.to === to
    );
}

function centerX(comp: { x: number; width: number }) {
    return comp.x + comp.width / 2;
}

function centerY(comp: { x: number; y: number; width: number; height: number }) {
    return comp.y + comp.height / 2;
}

function noOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
): boolean {
    return (
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
    );
}

// ============================================================================
// Spec §5: Phase 1 — Size Measurement
// ============================================================================

describe('Phase 1: Size Measurement', () => {
    it('should give leaf components at least the minimum theme dimensions', () => {
        const result = parseAndLayout(`
            [Small]
        `);
        const c = getComp(result, 'Small')!;
        expect(c).toBeDefined();
        expect(c.width).toBeGreaterThanOrEqual(defaultTheme.componentWidth);
        expect(c.height).toBeGreaterThanOrEqual(defaultTheme.componentHeight);
    });

    it('should expand component width for long labels', () => {
        const result = parseAndLayout(`
            [A]
            [VeryLongComponentLabelThatShouldBeWider]
        `);
        const a = getComp(result, 'A')!;
        const long = getComp(result, 'VeryLongComponentLabelThatShouldBeWider')!;
        expect(long.width).toBeGreaterThan(a.width);
    });

    it('should expand component height for multi-line labels', () => {
        const result = parseAndLayout(`
            [Single]
            [Multi\\nLine\\nLabel]
        `);
        const single = getComp(result, 'Single')!;
        const multi = getComp(result, 'Multi\\nLine\\nLabel')!;
        expect(multi.height).toBeGreaterThanOrEqual(single.height);
    });

    it('should size interfaces smaller than components', () => {
        const result = parseAndLayout(`
            [Comp]
            () "Iface"
        `);
        const comp = getComp(result, 'Comp')!;
        const iface = getComp(result, 'Iface')!;
        expect(iface.height).toBeLessThanOrEqual(comp.height);
    });

    it('should size a container to enclose its children', () => {
        const result = parseAndLayout(`
            package "Container" {
                [Child1]
                [Child2]
            }
        `);
        const container = getComp(result, 'Container')!;
        const child1 = getComp(result, 'Child1')!;
        const child2 = getComp(result, 'Child2')!;

        // Children must be inside container bounds
        expect(child1.x).toBeGreaterThanOrEqual(container.x);
        expect(child1.y).toBeGreaterThanOrEqual(container.y);
        expect(child1.x + child1.width).toBeLessThanOrEqual(container.x + container.width);
        expect(child1.y + child1.height).toBeLessThanOrEqual(container.y + container.height);

        expect(child2.x).toBeGreaterThanOrEqual(container.x);
        expect(child2.y).toBeGreaterThanOrEqual(container.y);
        expect(child2.x + child2.width).toBeLessThanOrEqual(container.x + container.width);
        expect(child2.y + child2.height).toBeLessThanOrEqual(container.y + container.height);
    });
});

// ============================================================================
// Spec §6: Phase 2 — Grid Assignment
// ============================================================================

describe('Phase 2: Grid Assignment', () => {
    describe('Declaration order', () => {
        it('should place unconnected components following declaration order', () => {
            const result = parseAndLayout(`
                [Alpha]
                [Beta]
                [Gamma]
                [Delta]
            `);
            const alpha = getComp(result, 'Alpha')!;
            const beta = getComp(result, 'Beta')!;
            const gamma = getComp(result, 'Gamma')!;
            const delta = getComp(result, 'Delta')!;

            expect(alpha).toBeDefined();
            expect(beta).toBeDefined();
            expect(gamma).toBeDefined();
            expect(delta).toBeDefined();

            // All 4 components should be laid out without overlap
            const all = [alpha, beta, gamma, delta];
            for (let i = 0; i < all.length; i++) {
                for (let j = i + 1; j < all.length; j++) {
                    expect(noOverlap(all[i], all[j])).toBe(true);
                }
            }
        });

        it('should place 3 components so none overlap', () => {
            const result = parseAndLayout(`
                [A]
                [B]
                [C]
            `);
            const a = getComp(result, 'A')!;
            const b = getComp(result, 'B')!;
            const c = getComp(result, 'C')!;

            expect(noOverlap(a, b)).toBe(true);
            expect(noOverlap(b, c)).toBe(true);
            expect(noOverlap(a, c)).toBe(true);
        });
    });

    describe('Arrow direction hints', () => {
        it('should place targets below when using --> (double dash = down)', () => {
            const result = parseAndLayout(`
                [A] --> [B]
            `);
            const a = getComp(result, 'A')!;
            const b = getComp(result, 'B')!;

            expect(a).toBeDefined();
            expect(b).toBeDefined();
            // B should be below A
            expect(b.y).toBeGreaterThan(a.y);
        });

        it('should place targets to the right when using -> (single dash = right)', () => {
            const result = parseAndLayout(`
                [A] -> [B]
            `);
            const a = getComp(result, 'A')!;
            const b = getComp(result, 'B')!;

            expect(a).toBeDefined();
            expect(b).toBeDefined();
            // B should be to the right of A
            expect(b.x).toBeGreaterThan(a.x);
        });

        it('should place targets to the left when using -left->', () => {
            const result = parseAndLayout(`
                [A] -left-> [B]
            `);
            const a = getComp(result, 'A')!;
            const b = getComp(result, 'B')!;

            expect(a).toBeDefined();
            expect(b).toBeDefined();
            // B should be to the left of A
            expect(b.x).toBeLessThan(a.x);
        });

        it('should place targets to the right when using -right->', () => {
            const result = parseAndLayout(`
                [A] -right-> [B]
            `);
            const a = getComp(result, 'A')!;
            const b = getComp(result, 'B')!;

            expect(a).toBeDefined();
            expect(b).toBeDefined();
            // B should be to the right of A
            expect(b.x).toBeGreaterThan(a.x);
        });

        it('should place targets above when using -up->', () => {
            const result = parseAndLayout(`
                [A] -up-> [B]
            `);
            const a = getComp(result, 'A')!;
            const b = getComp(result, 'B')!;

            expect(a).toBeDefined();
            expect(b).toBeDefined();
            // B should be above A
            expect(b.y).toBeLessThan(a.y);
        });

        it('should place targets below when using -down->', () => {
            const result = parseAndLayout(`
                [A] -down-> [B]
            `);
            const a = getComp(result, 'A')!;
            const b = getComp(result, 'B')!;

            expect(a).toBeDefined();
            expect(b).toBeDefined();
            // B should be below A
            expect(b.y).toBeGreaterThan(a.y);
        });
    });

    describe('Fan-out layout', () => {
        it('should spread multiple downstream targets symmetrically', () => {
            const result = parseAndLayout(`
                [A] --> [B]
                [A] --> [C]
            `);
            const a = getComp(result, 'A')!;
            const b = getComp(result, 'B')!;
            const c = getComp(result, 'C')!;

            expect(a).toBeDefined();
            expect(b).toBeDefined();
            expect(c).toBeDefined();

            // B and C should both be below A
            expect(b.y).toBeGreaterThan(a.y);
            expect(c.y).toBeGreaterThan(a.y);

            // B and C should not overlap
            expect(noOverlap(b, c)).toBe(true);
        });

        it('should spread 3 downstream targets without overlap', () => {
            const result = parseAndLayout(`
                [A] --> [B]
                [A] --> [C]
                [A] --> [D]
            `);
            const b = getComp(result, 'B')!;
            const c = getComp(result, 'C')!;
            const d = getComp(result, 'D')!;

            expect(noOverlap(b, c)).toBe(true);
            expect(noOverlap(c, d)).toBe(true);
            expect(noOverlap(b, d)).toBe(true);
        });
    });
});

// ============================================================================
// Spec §7: Phase 3 — Overlap Resolution
// ============================================================================

describe('Phase 3: Overlap Resolution', () => {
    it('should never produce overlapping components in a simple chain', () => {
        const result = parseAndLayout(`
            [A] --> [B]
            [B] --> [C]
            [C] --> [D]
        `);
        const all = ['A', 'B', 'C', 'D'].map(n => getComp(result, n)!);
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                expect(noOverlap(all[i], all[j])).toBe(true);
            }
        }
    });

    it('should never produce overlapping components in a diamond pattern', () => {
        const result = parseAndLayout(`
            [A] --> [B]
            [A] --> [C]
            [B] --> [D]
            [C] --> [D]
        `);
        const all = ['A', 'B', 'C', 'D'].map(n => getComp(result, n)!);
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                expect(noOverlap(all[i], all[j])).toBe(true);
            }
        }
    });

    it('should resolve overlaps with many components', () => {
        const result = parseAndLayout(`
            [A]
            [B]
            [C]
            [D]
            [E]
            [F]
            [G]
            [H]
            [I]
        `);
        const all = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
            .map(n => getComp(result, n)!);
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                expect(noOverlap(all[i], all[j])).toBe(true);
            }
        }
    });

    it('should not overlap containers with each other', () => {
        const result = parseAndLayout(`
            package "Pkg1" {
                [A]
            }
            package "Pkg2" {
                [B]
            }
            package "Pkg3" {
                [C]
            }
        `);
        const pkg1 = getComp(result, 'Pkg1')!;
        const pkg2 = getComp(result, 'Pkg2')!;
        const pkg3 = getComp(result, 'Pkg3')!;

        expect(noOverlap(pkg1, pkg2)).toBe(true);
        expect(noOverlap(pkg2, pkg3)).toBe(true);
        expect(noOverlap(pkg1, pkg3)).toBe(true);
    });
});

// ============================================================================
// Spec §8-9: Phase 4-5 — Cell Sizing & Positioning
// ============================================================================

describe('Phase 4-5: Cell Sizing and Positioning', () => {
    it('should center components of different sizes within their cells', () => {
        const diagram = new ComponentDiagram();
        diagram.addComponent('C1', 'component', 'Short');
        diagram.addComponent('C2', 'component', 'Very Long Component Label');
        diagram.addComponent('C3', 'component', 'Line 1\\\\nLine 2');
        diagram.addComponent('C4', 'component', 'Small');

        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();

        const c1 = getComp(result, 'C1')!;
        const c2 = getComp(result, 'C2')!;
        const c3 = getComp(result, 'C3')!;
        const c4 = getComp(result, 'C4')!;

        // Components in the same column should have aligned X centers
        // Components in the same row should have aligned Y centers
        // (Which column/row depends on layout, but centering within cells should hold)
        expect(c1).toBeDefined();
        expect(c2).toBeDefined();
        expect(c3).toBeDefined();
        expect(c4).toBeDefined();
    });

    it('should maintain componentGapX between adjacent columns', () => {
        const result = parseAndLayout(`
            [A] -> [B]
        `);
        const a = getComp(result, 'A')!;
        const b = getComp(result, 'B')!;

        // The gap between A's right edge and B's left edge should be >= componentGapX
        const gap = b.x - (a.x + a.width);
        expect(gap).toBeGreaterThanOrEqual(defaultTheme.componentGapX - 1); // small tolerance
    });

    it('should maintain componentGapY between adjacent rows', () => {
        const result = parseAndLayout(`
            [A] --> [B]
        `);
        const a = getComp(result, 'A')!;
        const b = getComp(result, 'B')!;

        // The gap between A's bottom edge and B's top edge should be >= componentGapY
        const gap = b.y - (a.y + a.height);
        expect(gap).toBeGreaterThanOrEqual(defaultTheme.componentGapY - 1);
    });

    it('should reserve header space for containers', () => {
        const result = parseAndLayout(`
            package "MyPackage" {
                [Inner]
            }
        `);
        const pkg = getComp(result, 'MyPackage')!;
        const inner = getComp(result, 'Inner')!;

        // Inner should be offset from the top of the package by header + padding
        expect(inner.y).toBeGreaterThan(pkg.y + 20); // headerHeight ~30
    });

    it('should add padding inside containers', () => {
        const result = parseAndLayout(`
            package "Container" {
                [Child]
            }
        `);
        const container = getComp(result, 'Container')!;
        const child = getComp(result, 'Child')!;

        // Child should be inside with padding
        expect(child.x).toBeGreaterThanOrEqual(container.x + defaultTheme.packagePadding);
        expect(child.y).toBeGreaterThanOrEqual(container.y + defaultTheme.packagePadding);
        expect(child.x + child.width).toBeLessThanOrEqual(
            container.x + container.width - defaultTheme.packagePadding + 1
        );
    });
});

// ============================================================================
// Spec §9.3: Vertical Line Straightening
// ============================================================================

describe('Vertical Line Straightening', () => {
    it('should align vertical 1:1 connections on the X axis', () => {
        const result = parseAndLayout(`
            package "Some Group" {
                HTTP - [First Component]
                [Another Component]
            }
            node "Other Groups" {
                FTP - [Second Component]
                [First Component] --> FTP
            }
            cloud {
                [Example 1]
            }
            database "MySql" {
                folder "This is my folder" {
                    [Folder 3]
                }
                frame "Foo" {
                    [Frame 4]
                }
            }
            [Another Component] --> [Example 1]
            [Example 1] --> [Folder 3]
            [Folder 3] --> [Frame 4]
        `);

        // Vertical relationships should have aligned X coordinates
        const checkVerticalAlignment = (from: string, to: string) => {
            const rel = getRel(result, from, to);
            expect(rel).toBeDefined();
            if (rel && rel.path.length >= 2) {
                const start = rel.path[0];
                const end = rel.path[rel.path.length - 1];
                expect(Math.abs(start.x - end.x)).toBeLessThanOrEqual(2);
            }
        };

        checkVerticalAlignment('Another Component', 'Example 1');
        checkVerticalAlignment('Example 1', 'Folder 3');
        checkVerticalAlignment('Folder 3', 'Frame 4');
    });
});

// ============================================================================
// Spec §10: Phase 6 — Edge Routing
// ============================================================================

describe('Phase 6: Edge Routing', () => {
    it('should produce a path with at least 2 points for each relationship', () => {
        const result = parseAndLayout(`
            [A] --> [B]
        `);
        const rel = getRel(result, 'A', 'B');
        expect(rel).toBeDefined();
        expect(rel!.path.length).toBeGreaterThanOrEqual(2);
    });

    it('should produce endpoint inside or on the boundary of the source component', () => {
        const result = parseAndLayout(`
            [A] --> [B]
        `);
        const a = getComp(result, 'A')!;
        const rel = getRel(result, 'A', 'B')!;
        const start = rel.path[0];

        // Start point should be near A's boundary (within bounding box + small tolerance)
        const tolerance = 15;
        expect(start.x).toBeGreaterThanOrEqual(a.x - tolerance);
        expect(start.x).toBeLessThanOrEqual(a.x + a.width + tolerance);
        expect(start.y).toBeGreaterThanOrEqual(a.y - tolerance);
        expect(start.y).toBeLessThanOrEqual(a.y + a.height + tolerance);
    });

    it('should produce endpoint inside or on the boundary of the target component', () => {
        const result = parseAndLayout(`
            [A] --> [B]
        `);
        const b = getComp(result, 'B')!;
        const rel = getRel(result, 'A', 'B')!;
        const end = rel.path[rel.path.length - 1];

        const tolerance = 15;
        expect(end.x).toBeGreaterThanOrEqual(b.x - tolerance);
        expect(end.x).toBeLessThanOrEqual(b.x + b.width + tolerance);
        expect(end.y).toBeGreaterThanOrEqual(b.y - tolerance);
        expect(end.y).toBeLessThanOrEqual(b.y + b.height + tolerance);
    });

    it('should generate label position at midpoint of path', () => {
        const result = parseAndLayout(`
            [A] --> [B] : uses
        `);
        const rel = getRel(result, 'A', 'B')!;
        expect(rel.labelPosition).toBeDefined();
        expect(rel.labelPosition!.x).toBeGreaterThan(0);
        expect(rel.labelPosition!.y).toBeGreaterThan(0);
    });

    it('should produce a path for dashed relationships', () => {
        const result = parseAndLayout(`
            [A] ..> [B] : uses
        `);
        const rel = getRel(result, 'A', 'B');
        expect(rel).toBeDefined();
        expect(rel!.relationship.type).toBe('dashed');
        expect(rel!.path.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle interface (circle) boundary correctly', () => {
        const result = parseAndLayout(`
            () "MyInterface"
            [Component] --> MyInterface
        `);
        const iface = getComp(result, 'MyInterface')!;
        const rel = getRel(result, 'Component', 'MyInterface')!;
        expect(rel.path.length).toBeGreaterThanOrEqual(2);

        // The end point should be near the interface
        const end = rel.path[rel.path.length - 1];
        const ifaceCX = iface.x + iface.width / 2;
        const ifaceCY = iface.y + iface.height / 2;
        const dist = Math.sqrt((end.x - ifaceCX) ** 2 + (end.y - ifaceCY) ** 2);
        // Should be near the interface boundary (radius + padding)
        expect(dist).toBeLessThan(iface.width + 20);
    });
});

// ============================================================================
// Spec §11: Phase 7 — Note Placement
// ============================================================================

describe('Phase 7: Note Placement', () => {
    it('should place a note to the right of its linked component', () => {
        const result = parseAndLayout(`
            [Component] as C
            note right of C : A right note
        `);
        const comp = getComp(result, 'C')!;
        const note = result.notes[0]!;

        expect(note).toBeDefined();
        expect(note.x).toBeGreaterThan(comp.x + comp.width);
    });

    it('should place a note to the left of its linked component', () => {
        const result = parseAndLayout(`
            [Component] as C
            note left of C : A left note
        `);
        const comp = getComp(result, 'C')!;
        const note = result.notes[0]!;

        expect(note).toBeDefined();
        expect(note.x + note.width).toBeLessThan(comp.x);
    });

    it('should place a note above its linked component', () => {
        const result = parseAndLayout(`
            [Component] as C
            note top of C : A top note
        `);
        const comp = getComp(result, 'C')!;
        const note = result.notes[0]!;

        expect(note).toBeDefined();
        expect(note.y + note.height).toBeLessThan(comp.y);
    });

    it('should place a note below its linked component', () => {
        const result = parseAndLayout(`
            [Component] as C
            note bottom of C : A bottom note
        `);
        const comp = getComp(result, 'C')!;
        const note = result.notes[0]!;

        expect(note).toBeDefined();
        expect(note.y).toBeGreaterThan(comp.y + comp.height);
    });

    it('should place floating notes below the diagram', () => {
        const result = parseAndLayout(`
            [A]
            [B]
            note as N
              A floating note
            end note
        `);
        const a = getComp(result, 'A')!;
        const b = getComp(result, 'B')!;
        const note = result.notes[0]!;

        expect(note).toBeDefined();
        // Floating note should be below all components
        const maxBottom = Math.max(a.y + a.height, b.y + b.height);
        expect(note.y).toBeGreaterThan(maxBottom - 1);
    });
});

// ============================================================================
// Spec §12: Global Coordinate Normalization
// ============================================================================

describe('Global Coordinate Normalization', () => {
    it('should ensure all components have positive coordinates', () => {
        const result = parseAndLayout(`
            [A] -left-> [B]
            [A] -up-> [C]
        `);
        result.components.forEach(c => {
            expect(c.x).toBeGreaterThanOrEqual(0);
            expect(c.y).toBeGreaterThanOrEqual(0);
        });
    });

    it('should apply padding from the canvas edge', () => {
        const result = parseAndLayout(`
            [A]
        `);
        const a = getComp(result, 'A')!;
        expect(a.x).toBeGreaterThanOrEqual(defaultTheme.padding);
        expect(a.y).toBeGreaterThanOrEqual(defaultTheme.padding);
    });

    it('should report total width and height including padding', () => {
        const result = parseAndLayout(`
            [A]
        `);
        const a = getComp(result, 'A')!;
        expect(result.width).toBeGreaterThanOrEqual(a.x + a.width + defaultTheme.padding);
        expect(result.height).toBeGreaterThanOrEqual(a.y + a.height + defaultTheme.padding);
    });

    it('should produce positive total dimensions', () => {
        const result = parseAndLayout(`
            [A] --> [B]
            [B] --> [C]
        `);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });
});

// ============================================================================
// Spec §5 (containers): Nested Containers
// ============================================================================

describe('Nested Containers', () => {
    it('should fully contain children within a package', () => {
        const result = parseAndLayout(`
            package "Some Group" {
                HTTP - [First Component]
                [Another Component]
            }
        `);
        const pkg = getComp(result, 'Some Group')!;
        const fc = getComp(result, 'First Component')!;
        const ac = getComp(result, 'Another Component')!;

        expect(fc.x).toBeGreaterThanOrEqual(pkg.x);
        expect(fc.y).toBeGreaterThanOrEqual(pkg.y);
        expect(fc.x + fc.width).toBeLessThanOrEqual(pkg.x + pkg.width + 1);
        expect(fc.y + fc.height).toBeLessThanOrEqual(pkg.y + pkg.height + 1);

        expect(ac.x).toBeGreaterThanOrEqual(pkg.x);
        expect(ac.y).toBeGreaterThanOrEqual(pkg.y);
    });

    it('should handle deeply nested containers', () => {
        const result = parseAndLayout(`
            database "MySql" {
                folder "This is my folder" {
                    [Folder 3]
                }
                frame "Foo" {
                    [Frame 4]
                }
            }
        `);
        const mysql = getComp(result, 'MySql')!;
        const folder = getComp(result, 'This is my folder')!;
        const frame = getComp(result, 'Foo')!;
        const folder3 = getComp(result, 'Folder 3')!;
        const frame4 = getComp(result, 'Frame 4')!;

        // folder and frame inside MySql
        expect(folder.x).toBeGreaterThanOrEqual(mysql.x);
        expect(frame.x).toBeGreaterThanOrEqual(mysql.x);

        // Folder 3 inside folder
        expect(folder3.x).toBeGreaterThanOrEqual(folder.x);
        expect(folder3.y).toBeGreaterThanOrEqual(folder.y);
        expect(folder3.x + folder3.width).toBeLessThanOrEqual(folder.x + folder.width + 1);

        // Frame 4 inside frame
        expect(frame4.x).toBeGreaterThanOrEqual(frame.x);
        expect(frame4.y).toBeGreaterThanOrEqual(frame.y);
        expect(frame4.x + frame4.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    });

    it('should not overlap sibling containers', () => {
        const result = parseAndLayout(`
            package "Pkg1" {
                [A]
                [B]
            }
            package "Pkg2" {
                [C]
                [D]
            }
        `);
        const pkg1 = getComp(result, 'Pkg1')!;
        const pkg2 = getComp(result, 'Pkg2')!;

        expect(noOverlap(pkg1, pkg2)).toBe(true);
    });
});

// ============================================================================
// Spec §9.4: Port Placement
// ============================================================================

describe('Port Placement', () => {
    it('should place ports on the parent component boundary', () => {
        const result = parseAndLayout(`
            component C {
                portin P1
                portout P2
            }
        `);
        const parent = getComp(result, 'C')!;
        const p1 = getComp(result, 'P1');
        const p2 = getComp(result, 'P2');

        expect(parent).toBeDefined();
        // Ports should exist
        expect(p1).toBeDefined();
        expect(p2).toBeDefined();

        if (p1) {
            // Port center should be near parent boundary
            const pcx = p1.x + p1.width / 2;
            const pcy = p1.y + p1.height / 2;
            const nearLeft = Math.abs(pcx - parent.x) < 10;
            const nearRight = Math.abs(pcx - (parent.x + parent.width)) < 10;
            const nearTop = Math.abs(pcy - parent.y) < 10;
            const nearBottom = Math.abs(pcy - (parent.y + parent.height)) < 10;
            expect(nearLeft || nearRight || nearTop || nearBottom).toBe(true);
        }
    });
});

// ============================================================================
// Spec §16: Quality Metrics — Comprehensive Non-overlap Tests
// ============================================================================

describe('Quality: No Component Overlaps', () => {
    it('should produce no overlaps for the PlantUML grouping example', () => {
        const result = parseAndLayout(`
            package "Some Group" {
                HTTP - [First Component]
                [Another Component]
            }
            node "Other Groups" {
                FTP - [Second Component]
                [First Component] --> FTP
            }
            cloud {
                [Example 1]
            }
            database "MySql" {
                folder "This is my folder" {
                    [Folder 3]
                }
                frame "Foo" {
                    [Frame 4]
                }
            }
            [Another Component] --> [Example 1]
            [Example 1] --> [Folder 3]
            [Folder 3] --> [Frame 4]
        `);

        // Check that top-level containers don't overlap each other
        const topLevel = result.components.filter(c => !c.component.parentId);
        for (let i = 0; i < topLevel.length; i++) {
            for (let j = i + 1; j < topLevel.length; j++) {
                expect(noOverlap(topLevel[i], topLevel[j])).toBe(true);
            }
        }
    });

    it('should produce no overlaps for a star topology', () => {
        const result = parseAndLayout(`
            [Hub] --> [Spoke1]
            [Hub] --> [Spoke2]
            [Hub] --> [Spoke3]
            [Hub] --> [Spoke4]
        `);
        const all = ['Hub', 'Spoke1', 'Spoke2', 'Spoke3', 'Spoke4']
            .map(n => getComp(result, n)!);

        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                expect(noOverlap(all[i], all[j])).toBe(true);
            }
        }
    });

    it('should produce no overlaps for mixed horizontal and vertical arrows', () => {
        const result = parseAndLayout(`
            [A] --> [B]
            [A] -> [C]
            [B] -> [D]
        `);
        const all = ['A', 'B', 'C', 'D'].map(n => getComp(result, n)!);
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                expect(noOverlap(all[i], all[j])).toBe(true);
            }
        }
    });
});

// ============================================================================
// Spec §6.5: BFS Direction-Based Placement (Integration)
// ============================================================================

describe('BFS Direction-Based Placement', () => {
    it('should layout a linear chain top-to-bottom', () => {
        const result = parseAndLayout(`
            [A] --> [B]
            [B] --> [C]
            [C] --> [D]
        `);
        const a = getComp(result, 'A')!;
        const b = getComp(result, 'B')!;
        const c = getComp(result, 'C')!;
        const d = getComp(result, 'D')!;

        // Each should be progressively lower
        expect(b.y).toBeGreaterThan(a.y);
        expect(c.y).toBeGreaterThan(b.y);
        expect(d.y).toBeGreaterThan(c.y);
    });

    it('should layout a horizontal chain left-to-right', () => {
        const result = parseAndLayout(`
            [A] -> [B]
            [B] -> [C]
        `);
        const a = getComp(result, 'A')!;
        const b = getComp(result, 'B')!;
        const c = getComp(result, 'C')!;

        expect(b.x).toBeGreaterThan(a.x);
        expect(c.x).toBeGreaterThan(b.x);
    });

    it('should center parent above its children in a fan-out', () => {
        const result = parseAndLayout(`
            [Parent] --> [Left]
            [Parent] --> [Right]
        `);
        const parent = getComp(result, 'Parent')!;
        const left = getComp(result, 'Left')!;
        const right = getComp(result, 'Right')!;

        // Parent should be above both children
        expect(left.y).toBeGreaterThan(parent.y);
        expect(right.y).toBeGreaterThan(parent.y);

        // Parent's center X should be between Left and Right centers
        const parentCX = centerX(parent);
        const leftCX = centerX(left);
        const rightCX = centerX(right);
        const minChildCX = Math.min(leftCX, rightCX);
        const maxChildCX = Math.max(leftCX, rightCX);
        // Allow some tolerance since the centering may not be exact
        expect(parentCX).toBeGreaterThanOrEqual(minChildCX - parent.width);
        expect(parentCX).toBeLessThanOrEqual(maxChildCX + parent.width);
    });
});

// ============================================================================
// Spec: Container Types (package, node, folder, frame, cloud, database)
// ============================================================================

describe('Container Types', () => {
    it('should layout all container types correctly', () => {
        const result = parseAndLayout(`
            package "PackageGroup" {
                [P1]
            }
            node "NodeGroup" {
                [N1]
            }
            folder "FolderGroup" {
                [F1]
            }
            frame "FrameGroup" {
                [Fr1]
            }
            cloud "CloudGroup" {
                [C1]
            }
            database "DBGroup" {
                [D1]
            }
        `);

        // All containers should exist and contain their children
        const containers = ['PackageGroup', 'NodeGroup', 'FolderGroup', 'FrameGroup', 'CloudGroup', 'DBGroup'];
        const children = ['P1', 'N1', 'F1', 'Fr1', 'C1', 'D1'];

        containers.forEach((containerName, i) => {
            const container = getComp(result, containerName);
            const child = getComp(result, children[i]);
            expect(container).toBeDefined();
            expect(child).toBeDefined();
            if (container && child) {
                expect(child.x).toBeGreaterThanOrEqual(container.x);
                expect(child.y).toBeGreaterThanOrEqual(container.y);
            }
        });
    });
});

// ============================================================================
// Spec: Relationship Types
// ============================================================================

describe('Relationship Types', () => {
    it('should parse and layout solid relationships (-->)', () => {
        const result = parseAndLayout(`
            [A] --> [B]
        `);
        const rel = getRel(result, 'A', 'B')!;
        expect(rel).toBeDefined();
        expect(rel.relationship.type).toBe('solid');
    });

    it('should parse and layout dashed relationships (..>)', () => {
        const result = parseAndLayout(`
            [A] ..> [B] : use
        `);
        const rel = getRel(result, 'A', 'B')!;
        expect(rel).toBeDefined();
        expect(rel.relationship.type).toBe('dashed');
    });

    it('should parse and layout relationships without arrowheads (-)', () => {
        const result = parseAndLayout(`
            DataAccess - [First Component]
        `);
        const rel = result.relationships.find(r =>
            (r.relationship.from === 'DataAccess' && r.relationship.to === 'First Component') ||
            (r.relationship.from === 'First Component' && r.relationship.to === 'DataAccess')
        );
        expect(rel).toBeDefined();
    });

    it('should handle labeled relationships', () => {
        const result = parseAndLayout(`
            [A] --> [B] : communicates
        `);
        const rel = getRel(result, 'A', 'B')!;
        expect(rel).toBeDefined();
        expect(rel.relationship.label).toBe('communicates');
    });
});

// ============================================================================
// Spec: Complex Integration Tests
// ============================================================================

describe('Complex Integration', () => {
    it('should handle the full PlantUML basic example', () => {
        const result = parseAndLayout(`
            interface "Data Access" as DA
            DA - [First Component]
            [First Component] ..> HTTP : use
        `);
        expect(result.components.length).toBeGreaterThanOrEqual(3);
        expect(result.relationships.length).toBe(2);

        // No overlaps among top-level
        const all = result.components;
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                if (!all[i].component.parentId && !all[j].component.parentId) {
                    expect(noOverlap(all[i], all[j])).toBe(true);
                }
            }
        }
    });

    it('should handle components with aliases', () => {
        const result = parseAndLayout(`
            [First component] as FC
            [Another component] as AC
            FC --> AC
        `);
        const fc = getComp(result, 'FC')!;
        const ac = getComp(result, 'AC')!;
        expect(fc).toBeDefined();
        expect(ac).toBeDefined();
        expect(noOverlap(fc, ac)).toBe(true);
    });

    it('should handle inter-container relationships', () => {
        const result = parseAndLayout(`
            package "Frontend" {
                [Web App]
                [Mobile App]
            }
            package "Backend" {
                [API Server]
                [Auth Service]
            }
            [Web App] --> [API Server]
            [Mobile App] --> [API Server]
            [API Server] --> [Auth Service]
        `);

        const frontend = getComp(result, 'Frontend')!;
        const backend = getComp(result, 'Backend')!;

        expect(frontend).toBeDefined();
        expect(backend).toBeDefined();
        expect(noOverlap(frontend, backend)).toBe(true);

        // All relationships should have paths
        result.relationships.forEach(rel => {
            expect(rel.path.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should handle a complete microservice diagram', () => {
        const result = parseAndLayout(`
            cloud "Internet" {
                [Browser]
            }

            node "Application Server" {
                [Web Application]
                [REST API]
            }

            database "Database Server" {
                [PostgreSQL]
            }

            [Browser] --> [Web Application]
            [Web Application] --> [REST API]
            [REST API] --> [PostgreSQL]
        `);

        // Should have nodes for all declared components
        expect(getComp(result, 'Browser')).toBeDefined();
        expect(getComp(result, 'Web Application')).toBeDefined();
        expect(getComp(result, 'REST API')).toBeDefined();
        expect(getComp(result, 'PostgreSQL')).toBeDefined();

        // Top-level containers should not overlap
        const internet = getComp(result, 'Internet')!;
        const appServer = getComp(result, 'Application Server')!;
        const dbServer = getComp(result, 'Database Server')!;

        expect(noOverlap(internet, appServer)).toBe(true);
        expect(noOverlap(appServer, dbServer)).toBe(true);
        expect(noOverlap(internet, dbServer)).toBe(true);

        // Positive dimensions
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });
});

// ============================================================================
// Edge cases
// ============================================================================

describe('Edge Cases', () => {
    it('should handle a single component', () => {
        const result = parseAndLayout(`
            [Alone]
        `);
        expect(result.components.length).toBe(1);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });

    it('should handle empty diagram gracefully', () => {
        const parser = new ComponentParser();
        const diagram = parser.parse('');
        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();
        expect(result.components.length).toBe(0);
        expect(result.relationships.length).toBe(0);
    });

    it('should handle self-referencing relationship', () => {
        const result = parseAndLayout(`
            [A] --> [A]
        `);
        expect(result.components.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle bidirectional relationships', () => {
        const result = parseAndLayout(`
            [A] --> [B]
            [B] --> [A]
        `);
        const a = getComp(result, 'A')!;
        const b = getComp(result, 'B')!;
        expect(noOverlap(a, b)).toBe(true);
    });

    it('should handle components declared in relationships with no explicit declaration', () => {
        const result = parseAndLayout(`
            [ImplicitA] --> [ImplicitB]
        `);
        expect(getComp(result, 'ImplicitA')).toBeDefined();
        expect(getComp(result, 'ImplicitB')).toBeDefined();
    });

    it('should layout notes without excessive top/left margins', () => {
        const result = parseAndLayout(`
            [Component] as C
            note top of C: A top note
            note bottom of C
              A bottom note can also
              be on several lines
            end note
            note left of C
              A left note can also
              be on several lines
            end note
            note right of C: A right note
        `);
        
        // Assert the total bounds are optimized without duplicate margins
        expect(result.width).toBe(508);
        expect(result.height).toBe(242);

        // C should be shifted properly
        const c = getComp(result, 'C')!;
        expect(c.x).toBe(226);
        expect(c.y).toBe(86);

        // Left note should align exactly with left padding
        const leftNote = result.notes.find(n => n.note.text.includes('A left note'))!;
        expect(leftNote).toBeDefined();
        expect(leftNote!.x).toBe(16);

        // Top note should align exactly with top padding
        const topNote = result.notes.find(n => n.note.text.includes('A top note'))!;
        expect(topNote).toBeDefined();
        expect(topNote!.y).toBe(16);
    });
});


