import { ASTNode } from '../../../core/parser/ASTNode';

export interface SequenceDiagramAST extends ASTNode {
    type: 'SequenceDiagram';
    body: SequenceASTNode[];
}

export type SequenceASTNode =
    | ParticipantDeclAST
    | MessageAST
    | NoteAST
    | GroupAST
    | DividerAST
    | DelayAST
    | SpacingAST
    | AutonumberAST
    | AutoactivateAST
    | ActivationAST
    | CreateAST
    | DestroyAST
    | ReferenceAST
    | TimeConstraintAST
    | MetaAST;

export interface ParticipantDeclAST extends ASTNode {
    type: 'ParticipantDeclaration';
    declType: 'participant' | 'actor' | 'boundary' | 'control' | 'entity' | 'database' | 'collections' | 'queue';
    name: string;
    label?: string;
    stereotype?: string;
    order?: number;
    color?: string;
}

export interface MessageAST extends ASTNode {
    type: 'Message';
    tag?: string; // {tag} prefix
    from: string;
    to: string;
    arrow: string;
    text: string;
    shorthand?: string; // ++, --, ++--, --++, **, !!
    color?: string;
}

export interface NoteAST extends ASTNode {
    type: 'Note';
    position: 'left' | 'right' | 'over' | 'across';
    participants: string[];
    text: string;
    shape: 'rectangle' | 'hexagon' | 'bubble' | 'folder';
    color?: string;
    sameStep?: boolean;
}

export interface GroupAST extends ASTNode {
    type: 'Group';
    groupType: 'alt' | 'opt' | 'loop' | 'par' | 'break' | 'critical' | 'group' | 'partition' | 'box';
    label: string;
    body: SequenceASTNode[];
    sections: GroupSectionAST[];
}

export interface GroupSectionAST extends ASTNode {
    type: 'GroupSection';
    label: string;
    body: SequenceASTNode[];
}

export interface DividerAST extends ASTNode {
    type: 'Divider';
    label: string;
}

export interface DelayAST extends ASTNode {
    type: 'Delay';
    text?: string;
}

export interface SpacingAST extends ASTNode {
    type: 'Spacing';
    height: number;
}

export interface AutonumberAST extends ASTNode {
    type: 'Autonumber';
    action: 'start' | 'stop' | 'resume' | 'inc';
    start?: number | string;
    increment?: number;
    format?: string;
    level?: string; // for inc, e.g. A, B
}

export interface AutoactivateAST extends ASTNode {
    type: 'Autoactivate';
    enabled: boolean;
}

export interface ActivationAST extends ASTNode {
    type: 'Activation';
    action: 'activate' | 'deactivate';
    name: string;
    color?: string;
}

export interface CreateAST extends ASTNode {
    type: 'Create';
    name: string;
    declType?: 'participant' | 'actor' | 'boundary' | 'control' | 'entity' | 'database' | 'collections' | 'queue';
}

export interface DestroyAST extends ASTNode {
    type: 'Destroy';
    name: string;
}

export interface ReferenceAST extends ASTNode {
    type: 'Reference';
    participants: string[];
    label: string;
}

export interface TimeConstraintAST extends ASTNode {
    type: 'TimeConstraint';
    startTag: string;
    endTag: string;
    label: string;
}

export interface MetaAST extends ASTNode {
    type: 'Meta';
    metaType: 'title' | 'header' | 'footer' | 'hide_footbox';
    value?: string;
}
export class ParseError extends Error {
    constructor(message: string, public line: number, public column: number) {
        super(message);
        this.name = 'ParseError';
    }
}
