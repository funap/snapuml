import { SequenceDiagram, ArrowHead } from '../SequenceDiagram';
import {
    SequenceDiagramAST,
    SequenceASTNode,
    ParticipantDeclAST,
    MessageAST,
    NoteAST,
    GroupAST,
    DividerAST,
    DelayAST,
    SpacingAST,
    AutonumberAST,
    AutoactivateAST,
    ActivationAST,
    CreateAST,
    DestroyAST,
    ReferenceAST,
    MetaAST
} from './SequenceAST';

export class SequenceASTCompiler {
    private lastMessageStep = -1;
    private lastMessageFrom = '';
    private lastMessageTo = '';
    private lastMessageType = '';
    private lastActivationStep = new Map<string, number>();

    compile(ast: SequenceDiagramAST): SequenceDiagram {
        const diagram = new SequenceDiagram();
        
        // Reset state for this compilation run
        this.lastMessageStep = -1;
        this.lastMessageFrom = '';
        this.lastMessageTo = '';
        this.lastMessageType = '';
        this.lastActivationStep.clear();

        this.compileBody(diagram, ast.body);
        return diagram;
    }

    private compileBody(diagram: SequenceDiagram, body: SequenceASTNode[]) {
        for (const node of body) {
            this.compileNode(diagram, node);
        }
    }

    private compileNode(diagram: SequenceDiagram, node: SequenceASTNode) {
        switch (node.type) {
            case 'ParticipantDeclaration':
                this.compileParticipantDeclaration(diagram, node);
                break;
            case 'Message':
                this.compileMessage(diagram, node);
                break;
            case 'Note':
                this.compileNote(diagram, node);
                break;
            case 'Group':
                this.compileGroup(diagram, node);
                break;
            case 'Divider':
                diagram.addDivider(node.label);
                break;
            case 'Delay':
                diagram.addDelay(node.text);
                break;
            case 'Spacing':
                diagram.addSpacing(node.height);
                break;
            case 'Autonumber':
                this.compileAutonumber(diagram, node);
                break;
            case 'Autoactivate':
                diagram.setAutoactivate(node.enabled);
                break;
            case 'Activation':
                this.compileActivation(diagram, node);
                break;
            case 'Create':
                this.compileCreate(diagram, node);
                break;
            case 'Destroy':
                this.compileDestroy(diagram, node);
                break;
            case 'Reference':
                this.compileReference(diagram, node);
                break;
            case 'TimeConstraint':
                diagram.addTimeConstraint(node.startTag, node.endTag, node.label);
                break;
            case 'Meta':
                this.compileMeta(diagram, node);
                break;
        }
    }

    private compileParticipantDeclaration(diagram: SequenceDiagram, node: ParticipantDeclAST) {
        const name = node.name.replace(/^"(.*)"$/, '$1');
        const label = node.label ? node.label.replace(/^"(.*)"$/, '$1') : undefined;
        let participantName: string;
        let participantLabel: string | undefined;

        if (label) {
            if (label.startsWith('"')) {
                // participant ID as "Label"
                participantName = name;
                participantLabel = label.replace(/^"(.*)"$/, '$1');
            } else {
                // participant "Label" as ID
                participantName = label.replace(/^"(.*)"$/, '$1');
                participantLabel = name;
            }
        } else {
            participantName = name;
            participantLabel = undefined;
        }

        diagram.addParticipant(
            participantName,
            participantLabel,
            node.declType,
            node.order,
            node.color,
            node.stereotype
        );
    }

    private compileMessage(diagram: SequenceDiagram, node: MessageAST) {
        if (node.from === '' && node.to === '' && node.arrow === '<--') {
            const normalizedText = node.text.replace(/\\n/g, '\n');
            diagram.returnMessage(normalizedText);
            return;
        }

        let from = node.from;
        let to = node.to;
        if (from) from = from.replace(/^"(.*)"$/, '$1');
        if (to) to = to.replace(/^"(.*)"$/, '$1');
        if (!from || from === '[') from = '[';
        if (!to || to === ']') to = ']';

        let arrow = node.arrow;
        let sameStep = false;
        if (arrow.startsWith('/')) {
            sameStep = true;
            arrow = arrow.substring(1).trim();
            diagram.rewindStep();
        }

        let shorthand = node.shorthand;
        let autoActivColor = node.color;

        const arrowMatch = arrow.match(/^([<ox\\/]*)([-.]+)(?:\[(#\w+)\])?([-.]*)([>ox\\/]*)?(?:(--\+\+|\+\+--|--|\+\+|\*\*|!!))?$/i);
        if (arrowMatch) {
            let [, headStartStr, line1, msgColor, line2, headEndStr, arrowShorthand] = arrowMatch;
            if (arrowShorthand) {
                shorthand = arrowShorthand;
            }
            const lineFull = line1 + (line2 || '');
            const isDotted = lineFull.includes('..') || lineFull.includes('--');
            let isBidirectional = headStartStr.includes('<') && (headEndStr || '').includes('>');

            const mapHead = (s: string, isStart: boolean): ArrowHead => {
                if (!s) return 'none';
                if (s === '>') return 'default';
                if (s === '<') return 'default';
                if (s === '>>') return 'open';
                if (s === '<<') return 'open';
                if (s === '\\' || s === '/') return 'half';
                if (s === '\\\\' || s === '//') return 'open';
                if (s.includes('x')) return 'lost';
                if (s.includes('o')) {
                    return 'arrow-circle';
                }
                return 'default';
            };

            let arrowHead = mapHead(headEndStr || '', false);
            let startHead = mapHead(headStartStr || '', true);

            // Special cases
            if (headEndStr === 'x') arrowHead = 'lost';
            if (from === 'x') startHead = 'found';

            const normalizedText = node.text.replace(/\\n/g, '\n');
            const step = diagram.addMessage(from, to, normalizedText, isDotted ? 'dotted' : 'arrow', arrowHead, msgColor, isBidirectional, startHead);

            if (node.tag) {
                diagram.addTaggedStep(node.tag, step);
            }

            // Identify semantic sender and receiver for alignment logic
            let semanticFrom = from;
            let semanticTo = to;
            const isHead = (h: ArrowHead) => ['default', 'open', 'half', 'arrow-circle'].includes(h);

            if (isHead(startHead) && !isHead(arrowHead)) {
                semanticFrom = to;
                semanticTo = from;
            } else if (isHead(arrowHead) && !isHead(startHead)) {
                semanticFrom = from;
                semanticTo = to;
            }

            this.lastMessageStep = step;
            this.lastMessageFrom = semanticFrom;
            this.lastMessageTo = semanticTo;
            this.lastMessageType = isDotted ? 'dotted' : 'arrow';

            // Handle combined and single shorthands
            if (shorthand === '++') {
                if (autoActivColor && autoActivColor.startsWith('#')) {
                    const hexContent = autoActivColor.substring(1);
                    const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
                    if (!isHex) {
                        autoActivColor = hexContent;
                    }
                }
                diagram.activate(to, step, step, autoActivColor);
                this.lastActivationStep.set(to, step);
            } else if (shorthand === '--') {
                diagram.deactivate(from, step, step);
            } else if (shorthand === '--++') {
                diagram.deactivate(from, step, step);
                if (autoActivColor && autoActivColor.startsWith('#')) {
                    const hexContent = autoActivColor.substring(1);
                    const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
                    if (!isHex) {
                        autoActivColor = hexContent;
                    }
                }
                diagram.activate(to, step, step, autoActivColor);
                this.lastActivationStep.set(to, step);
            } else if (shorthand === '++--') {
                if (autoActivColor && autoActivColor.startsWith('#')) {
                    const hexContent = autoActivColor.substring(1);
                    const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
                    if (!isHex) {
                        autoActivColor = hexContent;
                    }
                }
                diagram.activate(from, step, step, autoActivColor);
                this.lastActivationStep.set(from, step);
                diagram.deactivate(to, step, step);
            } else if (shorthand === '**') {
                diagram.create(to, step);
            } else if (shorthand === '!!') {
                diagram.destroy(to, step);
            }
        }
    }

    private compileNote(diagram: SequenceDiagram, node: NoteAST) {
        const normPos = node.position;
        let participants = node.participants.map(p => p.replace(/^"(.*)"$/, '$1'));
        let associationStep: number | undefined;

        if (participants.length === 0) {
            if ((normPos === 'right' || normPos === 'left') && this.lastMessageFrom && this.lastMessageTo) {
                const idxFrom = diagram.participants.findIndex(p => p.name === this.lastMessageFrom);
                const idxTo = diagram.participants.findIndex(p => p.name === this.lastMessageTo);
                if (idxFrom !== -1 && idxTo !== -1) {
                    const pFrom = diagram.participants[idxFrom];
                    const pTo = diagram.participants[idxTo];
                    let isFromLeftOfTo = idxFrom < idxTo;
                    if (pFrom.order !== undefined && pTo.order !== undefined) {
                        isFromLeftOfTo = pFrom.order < pTo.order;
                    }
                    if (normPos === 'left') {
                        participants = [isFromLeftOfTo ? this.lastMessageFrom : this.lastMessageTo];
                    } else {
                        participants = [isFromLeftOfTo ? this.lastMessageTo : this.lastMessageFrom];
                    }
                } else {
                    participants = [this.lastMessageTo];
                }
                if (this.lastMessageStep !== -1) {
                    associationStep = this.lastMessageStep;
                }
            }
        }

        const normalizedText = node.text.replace(/\\n/g, '\n');
        diagram.addNote(
            normalizedText,
            node.position,
            participants,
            node.color,
            node.shape,
            associationStep
        );
    }

    private compileGroup(diagram: SequenceDiagram, node: GroupAST) {
        diagram.startGroup(node.groupType, node.label);
        
        for (const child of node.body) {
            this.compileNode(diagram, child);
        }

        for (const section of node.sections) {
            diagram.addGroupSection(section.label);
            for (const child of section.body) {
                this.compileNode(diagram, child);
            }
        }

        diagram.endGroup();
    }

    private compileActivation(diagram: SequenceDiagram, node: ActivationAST) {
        const name = node.name.replace(/^"(.*)"$/, '$1');
        let color = node.color;
        if (color && color.startsWith('#')) {
            const hexContent = color.substring(1);
            const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
            if (!isHex) color = hexContent;
        }

        if (node.action === 'activate') {
            if (name === this.lastMessageTo && this.lastMessageStep !== -1) {
                diagram.activate(name, this.lastMessageStep, this.lastMessageStep, color);
                this.lastActivationStep.set(name, this.lastMessageStep);
            } else {
                const step = diagram.nextStep();
                diagram.activate(name, step, undefined, color);
                this.lastActivationStep.set(name, step);
            }
        } else if (node.action === 'deactivate') {
            let shouldAlign = false;
            if (this.lastMessageStep !== -1 && this.lastMessageStep > (this.lastActivationStep.get(name) ?? -1)) {
                if (this.lastMessageType === 'arrow') {
                    shouldAlign = (name === this.lastMessageTo || name === this.lastMessageFrom);
                } else if (this.lastMessageType === 'dotted') {
                    shouldAlign = (name === this.lastMessageFrom);
                }
            }

            if (shouldAlign) {
                diagram.deactivate(name, this.lastMessageStep);
            } else {
                diagram.deactivate(name, diagram.nextStep());
            }
        }
    }

    private compileCreate(diagram: SequenceDiagram, node: CreateAST) {
        const name = node.name.replace(/^"(.*)"$/, '$1');
        diagram.addParticipant(name, undefined, node.declType);
        diagram.create(name, diagram.getCurrentStep());
    }

    private compileDestroy(diagram: SequenceDiagram, node: DestroyAST) {
        const name = node.name.replace(/^"(.*)"$/, '$1');
        let shouldAlign = false;
        if (this.lastMessageStep !== -1 && this.lastMessageStep > (this.lastActivationStep.get(name) ?? -1)) {
            if (this.lastMessageType === 'arrow') {
                shouldAlign = (name === this.lastMessageTo || name === this.lastMessageFrom);
            } else if (this.lastMessageType === 'dotted') {
                shouldAlign = (name === this.lastMessageFrom);
            }
        }

        if (shouldAlign) {
            diagram.destroy(name, this.lastMessageStep);
        } else {
            diagram.destroy(name, diagram.nextStep());
        }
    }

    private compileReference(diagram: SequenceDiagram, node: ReferenceAST) {
        const participants = node.participants.map(p => p.replace(/^"(.*)"$/, '$1'));
        diagram.addReference(participants, node.label);
    }

    private compileAutonumber(diagram: SequenceDiagram, node: AutonumberAST) {
        if (node.action === 'stop') {
            diagram.stopAutonumber();
        } else if (node.action === 'resume') {
            diagram.resumeAutonumber(node.increment, node.format);
        } else if (node.action === 'inc') {
            if (node.level) {
                diagram.incrementAutonumberLevel(node.level);
            }
        } else {
            // start
            const start = node.start !== undefined ? node.start : 1;
            const increment = node.increment !== undefined ? node.increment : 1;
            diagram.setAutonumber(start, increment, node.format);
        }
    }

    private compileMeta(diagram: SequenceDiagram, node: MetaAST) {
        if (node.metaType === 'title') {
            diagram.setTitle(node.value || '');
        } else if (node.metaType === 'header') {
            diagram.setHeader(node.value || '');
        } else if (node.metaType === 'footer') {
            diagram.setFooter(node.value || '');
        } else if (node.metaType === 'hide_footbox') {
            diagram.setHideFootbox(true);
        }
    }
}
