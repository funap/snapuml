import { ComponentDiagram, ComponentType, RelationshipType, Direction } from '../ComponentDiagram';
import {
    ComponentDiagramAST,
    ComponentASTNode,
    ComponentDeclAST,
    PortDeclAST,
    GroupContainerAST,
    RelationshipAST,
    ComponentNoteAST,
    PositionHintAST
} from './ComponentAST';

export class ComponentASTCompiler {
    private noteAliases = new Set<string>();

    compile(ast: ComponentDiagramAST): ComponentDiagram {
        const diagram = new ComponentDiagram();

        // Pass 1: Collect floating note aliases to avoid implicitly creating components for them in Pass 2
        this.collectNoteAliases(ast.body);

        // Pass 2: Main compilation
        this.compileNodes(ast.body, diagram);

        return diagram;
    }

    private collectNoteAliases(nodes: ComponentASTNode[]) {
        for (const node of nodes) {
            if (node.type === 'ComponentNote' && node.alias) {
                this.noteAliases.add(node.alias);
            } else if (node.type === 'GroupContainer') {
                this.collectNoteAliases(node.body);
            }
        }
    }

    private compileNodes(nodes: ComponentASTNode[], diagram: ComponentDiagram, parentId?: string) {
        for (const node of nodes) {
            switch (node.type) {
                case 'ComponentDeclaration':
                    this.compileDeclaration(node, diagram, parentId);
                    break;
                case 'PortDeclaration':
                    this.compilePort(node, diagram, parentId);
                    break;
                case 'GroupContainer':
                    this.compileGroup(node, diagram, parentId);
                    break;
                case 'Relationship':
                    this.compileRelationship(node, diagram, parentId);
                    break;
                case 'ComponentNote':
                    this.compileNote(node, diagram);
                    break;
                case 'PositionHint':
                    this.compilePositionHint(node, diagram, parentId);
                    break;
            }
        }
    }

    private compileDeclaration(node: ComponentDeclAST, diagram: ComponentDiagram, parentId?: string) {
        const cleanName = this.stripQuotes(node.name);
        const cleanLabel = node.label ? this.stripQuotes(node.label) : cleanName;
        const color = this.parseColor(node.color);

        const comp = diagram.addComponent(cleanName, node.declType, cleanLabel, parentId, color);
        if (node.description) {
            comp.label = node.description;
        }
    }

    private compilePort(node: PortDeclAST, diagram: ComponentDiagram, parentId?: string) {
        const cleanName = this.stripQuotes(node.name);
        const cleanLabel = node.label ? this.stripQuotes(node.label) : cleanName;
        diagram.addComponent(cleanName, node.portType, cleanLabel, parentId);
    }

    private compileGroup(node: GroupContainerAST, diagram: ComponentDiagram, parentId?: string) {
        const type = node.containerType as ComponentType;
        const cleanName = this.stripQuotes(node.name);
        
        let groupId = cleanName;
        if (!cleanName) {
            const count = diagram.components.filter(c => c.type === type).length;
            groupId = `${type}_${count}_group`;
            diagram.addComponent(groupId, type, '', parentId);
        } else {
            diagram.addComponent(cleanName, type, cleanName, parentId);
        }

        this.compileNodes(node.body, diagram, groupId);
    }

    private compileRelationship(node: RelationshipAST, diagram: ComponentDiagram, parentId?: string) {
        let fromVal = node.from.name;
        let toVal = node.to.name;
        let isFromBracketed = node.from.isBracketed;
        let isToBracketed = node.to.isBracketed;
        let isFromParens = node.from.isParens;
        let isToParens = node.to.isParens;

        const arrow = node.arrow;
        const hasReverse = arrow.includes('<');
        const hasForward = arrow.includes('>');

        // Swap from/to for reverse arrows like <-, <--
        if (hasReverse && !hasForward) {
            fromVal = node.to.name;
            toVal = node.from.name;
            isFromBracketed = node.to.isBracketed;
            isToBracketed = node.from.isBracketed;
            isFromParens = node.to.isParens;
            isToParens = node.from.isParens;
        }

        const id1 = this.stripQuotes(fromVal);
        const id2 = this.stripQuotes(toVal);

        // Implicit component creation if not already defined and not a note alias
        if (!diagram.components.some(c => c.name === id1) && !this.noteAliases.has(id1)) {
            const type = isFromBracketed ? 'component' : 'interface';
            diagram.addComponent(id1, type, id1, parentId);
        }
        if (!diagram.components.some(c => c.name === id2) && !this.noteAliases.has(id2)) {
            const type = isToBracketed ? 'component' : 'interface';
            diagram.addComponent(id2, type, id2, parentId);
        }

        // Determine arrow type
        let type: RelationshipType = 'solid';
        if (arrow.includes('..')) {
            type = 'dashed';
        }

        // Determine direction
        let direction: Direction | undefined = undefined;
        if (arrow.includes('left') || arrow.includes('le')) direction = 'left';
        else if (arrow.includes('right') || arrow.includes('ri')) direction = 'right';
        else if (arrow.includes('up')) direction = 'up';
        else if (arrow.includes('down') || arrow.includes('do')) direction = 'down';

        if (!direction) {
            const stripped = arrow.replace(/[<>]/g, '');
            const dashMatch = stripped.match(/(-+|\.+)/);
            if (dashMatch) {
                const len = dashMatch[1].length;
                if (hasReverse && !hasForward) {
                    direction = len >= 2 ? 'up' : 'left';
                } else {
                    direction = len >= 2 ? 'down' : 'right';
                }
            }
        }

        const hasArrowHead = hasForward || hasReverse;
        diagram.addRelationship(id1, id2, type, node.label, direction, hasArrowHead, parentId);
    }

    private compileNote(node: ComponentNoteAST, diagram: ComponentDiagram) {
        if (node.linkedTo) {
            const targetId = this.stripQuotes(node.linkedTo.name);
            // Auto-create component or interface for undefined note targets
            if (!diagram.findComponent(targetId)) {
                diagram.addComponent(targetId, node.linkedTo.isBracketed ? 'component' : 'interface');
            }
            diagram.addNote(node.text, node.position, targetId);
        } else if (node.alias) {
            diagram.addNote(node.text, undefined, undefined, node.alias);
        }
    }

    private compilePositionHint(node: PositionHintAST, diagram: ComponentDiagram, parentId?: string) {
        const cleanName = this.stripQuotes(node.name);
        const cleanRef = this.stripQuotes(node.reference);
        const color = this.parseColor(node.color);

        const comp = diagram.addComponent(cleanName, 'component', cleanName, parentId, color);
        comp.positionHint = { reference: cleanRef, position: node.position };
    }

    // Helper functions
    private stripQuotes(str: string): string {
        return str.replace(/^"(.*)"$/, '$1');
    }

    private parseColor(color: string | undefined): string | undefined {
        if (!color) return undefined;
        if (color.startsWith('#')) {
            const hexContent = color.substring(1);
            const isHex = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hexContent);
            if (isHex) {
                return color;
            } else {
                return hexContent;
            }
        }
        return color;
    }
}
