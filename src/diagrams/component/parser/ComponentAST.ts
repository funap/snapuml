import { ASTNode } from '../../../core/parser/ASTNode';

export interface ComponentDiagramAST extends ASTNode {
    type: 'ComponentDiagram';
    body: ComponentASTNode[];
}

export type ComponentASTNode =
    | ComponentDeclAST
    | PortDeclAST
    | GroupContainerAST
    | RelationshipAST
    | ComponentNoteAST
    | PositionHintAST;

export interface ComponentDeclAST extends ASTNode {
    type: 'ComponentDeclaration';
    declType: 'component' | 'interface';
    name: string;
    label?: string;
    alias?: string;
    color?: string;
    description?: string;
}

export interface PortDeclAST extends ASTNode {
    type: 'PortDeclaration';
    portType: 'port' | 'portin' | 'portout';
    name: string;
    alias?: string;
    label?: string;
}

export interface GroupContainerAST extends ASTNode {
    type: 'GroupContainer';
    containerType: 'package' | 'node' | 'folder' | 'frame' | 'cloud' | 'database' | 'component' | 'interface';
    name: string;
    body: ComponentASTNode[];
}

export interface RelationshipAST extends ASTNode {
    type: 'Relationship';
    from: { name: string; isBracketed: boolean; isParens: boolean };
    to: { name: string; isBracketed: boolean; isParens: boolean };
    arrow: string;
    label?: string;
}

export interface ComponentNoteAST extends ASTNode {
    type: 'ComponentNote';
    position?: 'left' | 'right' | 'top' | 'bottom';
    linkedTo?: { name: string; isBracketed: boolean };
    alias?: string;
    text: string;
}

export interface PositionHintAST extends ASTNode {
    type: 'PositionHint';
    name: string;
    position: 'left' | 'right' | 'top' | 'bottom';
    reference: string;
    color?: string;
}
