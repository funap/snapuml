import { describe, it, expect } from 'vitest';
import { SaltParser } from '../../src/diagrams/salt/SaltParser';
import { SaltRenderer } from '../../src/diagrams/salt/SaltRenderer';
import { render } from '../../src/index';

describe('Salt Diagram Parser & Renderer', () => {
    it('should parse basic widgets', () => {
        const input = `
        @startsalt
        {
          Just plain text
          [This is my button]
          ()  Unchecked radio
          (X) Checked radio
          []  Unchecked box
          [X] Checked box
          "Enter text here   "
          ^This is a droplist^
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        
        expect(diagram.root).toBeDefined();
        expect(diagram.root?.type).toBe('grid');
        
        const grid = diagram.root as any;
        expect(grid.rows.length).toBe(8);
        
        expect(grid.rows[0][0].type).toBe('label');
        expect(grid.rows[0][0].text).toBe('Just plain text');
        
        expect(grid.rows[1][0].type).toBe('button');
        expect(grid.rows[1][0].label).toBe('This is my button');
        
        expect(grid.rows[2][0].type).toBe('radio');
        expect(grid.rows[2][0].label).toBe('Unchecked radio');
        expect(grid.rows[2][0].checked).toBe(false);
        
        expect(grid.rows[3][0].type).toBe('radio');
        expect(grid.rows[3][0].label).toBe('Checked radio');
        expect(grid.rows[3][0].checked).toBe(true);
        
        expect(grid.rows[4][0].type).toBe('checkbox');
        expect(grid.rows[4][0].label).toBe('Unchecked box');
        expect(grid.rows[4][0].checked).toBe(false);
        
        expect(grid.rows[5][0].type).toBe('checkbox');
        expect(grid.rows[5][0].label).toBe('Checked box');
        expect(grid.rows[5][0].checked).toBe(true);
        
        expect(grid.rows[6][0].type).toBe('input');
        expect(grid.rows[6][0].label).toBe('Enter text here   ');
        
        expect(grid.rows[7][0].type).toBe('droplist');
        expect(grid.rows[7][0].label).toBe('This is a droplist');
    });

    it('should parse checkboxes and radios with space and case variations', () => {
        const input = `
        @startsalt
        {
          [ ] Space unchecked box
          [x] Lowercase checked box
          ( ) Space unchecked radio
          (x) Lowercase checked radio
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        const grid = diagram.root as any;

        expect(grid.rows[0][0].type).toBe('checkbox');
        expect(grid.rows[0][0].label).toBe('Space unchecked box');
        expect(grid.rows[0][0].checked).toBe(false);

        expect(grid.rows[1][0].type).toBe('checkbox');
        expect(grid.rows[1][0].label).toBe('Lowercase checked box');
        expect(grid.rows[1][0].checked).toBe(true);

        expect(grid.rows[2][0].type).toBe('radio');
        expect(grid.rows[2][0].label).toBe('Space unchecked radio');
        expect(grid.rows[2][0].checked).toBe(false);

        expect(grid.rows[3][0].type).toBe('radio');
        expect(grid.rows[3][0].label).toBe('Lowercase checked radio');
        expect(grid.rows[3][0].checked).toBe(true);
    });

    it('should support open droplists', () => {
        const input = `
        @startsalt
        {
          ^This is an open droplist^^ item 1^^ item 2^
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        const grid = diagram.root as any;
        
        expect(grid.rows[0][0].type).toBe('droplist');
        expect(grid.rows[0][0].label).toBe('This is an open droplist');
        expect(grid.rows[0][0].open).toBe(true);
        expect(grid.rows[0][0].items).toEqual(['item 1', 'item 2']);
    });

    it('should support line concatenation with trailing pipe', () => {
        const input = `
        @startsalt
        {
          ^This is a closed droplist^ |
          ^This is an open droplist^^ item 1^^ item 2^ |
          ^This is another open droplist^ item 1^ item 2^
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        expect(diagram.root).toBeDefined();
        expect(diagram.root?.type).toBe('grid');
        
        const grid = diagram.root as any;
        expect(grid.rows.length).toBe(1);
        expect(grid.rows[0].length).toBe(3);
        
        expect(grid.rows[0][0].type).toBe('droplist');
        expect(grid.rows[0][0].label).toBe('This is a closed droplist');
        expect(grid.rows[0][0].open).toBe(false);
        
        expect(grid.rows[0][1].type).toBe('droplist');
        expect(grid.rows[0][1].label).toBe('This is an open droplist');
        expect(grid.rows[0][1].open).toBe(true);
        expect(grid.rows[0][1].items).toEqual(['item 1', 'item 2']);
        
        expect(grid.rows[0][2].type).toBe('droplist');
        expect(grid.rows[0][2].label).toBe('This is another open droplist');
        expect(grid.rows[0][2].open).toBe(true);
        expect(grid.rows[0][2].items).toEqual(['item 1', 'item 2']);
    });

    it('should parse grid separators and column layout', () => {
        const input = `
        @startsalt
        {
          Login    | "MyName   "
          Password | "****     "
          [Cancel] | [  OK   ]
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        const grid = diagram.root as any;

        expect(grid.rows.length).toBe(3);
        expect(grid.rows[0].length).toBe(2);
        expect(grid.rows[0][0].text).toBe('Login');
        expect(grid.rows[0][1].type).toBe('input');
        expect(grid.rows[2][0].type).toBe('button');
        expect(grid.rows[2][0].label).toBe('Cancel');
        expect(grid.rows[2][1].label).toBe('  OK   ');
    });

    it('should parse grid line styles', () => {
        const input = `
        @startsalt
        {+
          Login    | "MyName   "
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        const grid = diagram.root as any;
        expect(grid.lineStyle).toBe('external');
    });

    it('should parse group boxes', () => {
        const input = `
        @startsalt
        {^"My group box"
          Login    | "MyName   "
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        
        expect(diagram.root?.type).toBe('groupbox');
        const gb = diagram.root as any;
        expect(gb.title).toBe('My group box');
        expect(gb.content.type).toBe('grid');
    });

    it('should parse line separators in grid', () => {
        const input = `
        @startsalt
        {
          Text1
          ..
          "Some field"
          ==
          Note on usage
          ~~
          Another text
          --
          [Ok]
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        const grid = diagram.root as any;

        expect(grid.rows[1][0].type).toBe('separator');
        expect(grid.rows[1][0].style).toBe('dotted');
        
        expect(grid.rows[3][0].type).toBe('separator');
        expect(grid.rows[3][0].style).toBe('double');
        
        expect(grid.rows[5][0].type).toBe('separator');
        expect(grid.rows[5][0].style).toBe('strong');
        
        expect(grid.rows[7][0].type).toBe('separator');
        expect(grid.rows[7][0].style).toBe('single');
    });

    it('should parse tree widget and tree tables', () => {
        const input = `
        @startsalt
        {T!
         + World        | 7.13 billion
         ++ America     | 964 million
         +++ Canada     | 35 million
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        
        expect(diagram.root?.type).toBe('tree');
        const tree = diagram.root as any;
        expect(tree.lineStyle).toBe('vertical');
        expect(tree.nodes.length).toBe(3);
        
        expect(tree.nodes[0].level).toBe(1);
        expect(tree.nodes[0].cells[0].text).toBe('World');
        expect(tree.nodes[0].cells[1].text).toBe('7.13 billion');
        
        expect(tree.nodes[1].level).toBe(2);
        expect(tree.nodes[1].cells[0].text).toBe('America');
        
        expect(tree.nodes[2].level).toBe(3);
        expect(tree.nodes[2].cells[0].text).toBe('Canada');
    });

    it('should parse horizontal and vertical tabs', () => {
        const inputH = `
        @startsalt
        {/ <b>General | Fullscreen | Behavior | Saving }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagH = parser.parse(inputH);
        expect(diagH.root?.type).toBe('tabs');
        const tabsH = diagH.root as any;
        expect(tabsH.vertical).toBe(false);
        expect(tabsH.tabs).toEqual(['General', 'Fullscreen', 'Behavior', 'Saving']);
        expect(tabsH.activeIndex).toBe(0);

        const inputV = `
        @startsalt
        {/ <b>General
        Fullscreen
        Behavior
        Saving }
        @endsalt
        `;
        const diagV = parser.parse(inputV);
        expect(diagV.root?.type).toBe('tabs');
        const tabsV = diagV.root as any;
        expect(tabsV.vertical).toBe(true);
        expect(tabsV.tabs).toEqual(['General', 'Fullscreen', 'Behavior', 'Saving']);
        expect(tabsV.activeIndex).toBe(0);
    });

    it('should parse menus', () => {
        const input = `
        @startsalt
        {+
        {* File | Edit | Source | Refactor
         Refactor | New | Open File | - | Close | Close All }
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        const grid = diagram.root as any;
        
        expect(grid.rows[0][0].type).toBe('menu');
        const menu = grid.rows[0][0];
        expect(menu.items).toEqual(['File', 'Edit', 'Source', 'Refactor']);
        expect(menu.openIndex).toBe(3); // Refactor
        expect(menu.dropdownItems).toEqual(['New', 'Open File', '-', 'Close', 'Close All']);
    });

    it('should parse scroll containers', () => {
        const input = `
        @startsalt
        {SI
           This is a long
           text in a textarea
           .
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        
        expect(diagram.root?.type).toBe('scroll');
        const scroll = diagram.root as any;
        expect(scroll.vertical).toBe(true);
        expect(scroll.horizontal).toBe(false);
        expect(scroll.content.type).toBe('grid');
    });

    it('should parse top-level directives', () => {
        const input = `
        @startsalt
        title My title
        header some header
        footer some footer
        caption This is caption
        legend
        The legend
        end legend
        scale 2
        skinparam Backgroundcolor palegreen
        !option handwritten true
        
        {
          [Button]
        }
        @endsalt
        `;
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        
        expect(diagram.title).toBe('My title');
        expect(diagram.header).toBe('some header');
        expect(diagram.footer).toBe('some footer');
        expect(diagram.caption).toBe('This is caption');
        expect(diagram.legend).toBe('The legend');
        expect(diagram.scale).toBe(2);
        expect(diagram.backgroundColor).toBe('palegreen');
        expect(diagram.handwritten).toBe(true);
    });

    it('should render salt to valid SVG', () => {
        const input = `
        @startsalt
        {
          Login<&person> | "MyName   "
          Password<&key> | "****     "
          [Cancel <&circle-x>] | [OK <&account-login>]
        }
        @endsalt
        `;
        const renderer = new SaltRenderer();
        const parser = new SaltParser();
        const diagram = parser.parse(input);
        const svg = renderer.render(diagram);

        expect(svg).toContain('<svg');
        expect(svg).toContain('Login');
        expect(svg).toContain('Password');
        expect(svg).toContain('Cancel');
        // Check for OpenIconic render paths
        expect(svg).toContain('circle cx=');
    });

    it('should automatically route in index.ts render()', () => {
        const input = `
        @startsalt
        {
          [Ok]
        }
        @endsalt
        `;
        const svg = render(input);
        expect(svg).toContain('svg');
        expect(svg).toContain('Ok');
    });

    it('should render menu dropdowns at the end of the SVG (overlays)', () => {
        const input = `
        @startsalt
        {+
        {* File | Edit | Source | Refactor
         Refactor | New | Open File | - | Close | Close All }
        {/ General | Fullscreen | Behavior }
        }
        @endsalt
        `;
        const svg = render(input);
        expect(svg).toContain('svg');
        expect(svg).toContain('Refactor');
        expect(svg).toContain('General');
        
        // The dropdown contains "Open File" and "Close All"
        expect(svg).toContain('Open File');
        expect(svg).toContain('Close All');

        // Check that the dropdown items are rendered after "General" (which is in the tabs block)
        const indexOfGeneral = svg.indexOf('General');
        const indexOfCloseAll = svg.indexOf('Close All');
        expect(indexOfCloseAll).toBeGreaterThan(indexOfGeneral);
    });

    it('should render grid line styles in SVG output', () => {
        const input = `
        @startsalt
        {+
          Login    | "MyName"
          Password | "****"
        }
        @endsalt
        `;
        const svg = render(input);
        expect(svg).toContain('<svg');
        // External border should be drawn
        expect(svg).toContain('<rect');
        expect(svg).toContain('stroke="#d1d5db"');
        expect(svg).toContain('****');
    });

    it('should render internal grid lines in SVG output', () => {
        const input = `
        @startsalt
        {#
          Login    | "MyName"
          Password | "****"
        }
        @endsalt
        `;
        const svg = render(input);
        expect(svg).toContain('<svg');
        // Both vertical/horizontal divider lines should be drawn
        expect(svg).toContain('<line');
        expect(svg).toContain('****');
    });
});

