import { Diagram } from '../../core/Diagram';
import { decodeUnicode } from '../../core/RichText';

export type ParticipantType = 'participant' | 'actor' | 'boundary' | 'control' | 'entity' | 'database' | 'collections' | 'queue';

export interface Participant {
    name: string;
    label?: string;
    type: ParticipantType;
    order?: number;
    color?: string;
    stereotype?: string;
    destroyedStep?: number;
    createdStep?: number;
}

export interface Activation {
    participantName: string;
    startStep: number;
    endStep?: number;
    level: number;
    sourceStep?: number;
    endSourceStep?: number;
    color?: string;
}


export type ArrowHead = 'default' | 'open' | 'async' | 'half' | 'circle' | 'lost' | 'found' | 'none' | 'arrow-circle';

export interface Message {
    from: string;
    to: string;
    text: string;
    type: 'arrow' | 'dotted';
    step: number;
    arrowHead?: ArrowHead;
    startHead?: ArrowHead;
    color?: string;
    bidirectional?: boolean;
    number?: string;
    arrowDelay?: number;
}

export interface Note {
    participantName?: string;
    participants?: string[];
    position: 'left' | 'right' | 'over' | 'across';
    text: string;
    step: number;
    color?: string;
    shape?: 'rectangle' | 'hexagon' | 'bubble' | 'folder';
    owner?: Group;
}

export interface Group {
    type: string;
    label: string;
    startStep: number;
    endStep?: number;
    sections: { label: string; startStep: number; color?: string }[];
    level: number;
    participants: string[];
    color?: string;
    headerColor?: string;
}

export interface Reference {
    participants: string[];
    label: string;
    startStep: number;
    endStep: number;
}

export interface Divider {
    label: string;
    step: number;
}

export interface Delay {
    text?: string;
    step: number;
}

export interface Spacing {
    height: number;
    step: number;
}

export interface Autonumber {
    start: number;
    increment: number;
    format?: string;
}

export interface TimeConstraint {
    startTag: string;
    endTag: string;
    label: string;
}

export class SequenceDiagram implements Diagram {
    type = 'sequence';
    participants: Participant[] = [];
    messages: Message[] = [];
    activations: Activation[] = [];
    groups: Group[] = [];
    references: Reference[] = [];
    notes: Note[] = [];
    dividers: Divider[] = [];
    delays: Delay[] = [];
    spacings: Spacing[] = [];
    timeConstraints: TimeConstraint[] = [];
    taggedSteps: Map<string, number> = new Map();

    title?: string;
    header?: string;
    footer?: string;
    hideFootbox: boolean = false;
    delayStyle: 'dots' | 'space' | 'lifeline' = 'space';

    private currentStep = 0;
    private groupStack: Group[] = [];
    private autonumberConfig: Autonumber | null = null;
    private currentAutonumbers: number[] = [0];
    private autonumberDelimiter: string = '.';
    private autonumberStopped = false;
    autoactivateEnabled = false;

    setHideFootbox(hide: boolean) {
        this.hideFootbox = hide;
    }

    addParticipant(name: string, label?: string, type: ParticipantType = 'participant', order?: number, color?: string, stereotype?: string) {
        let participant = this.participants.find(p => p.name === name);
        if (!participant) {
            participant = { name, label, type, order, color, stereotype };
            this.participants.push(participant);
        } else {
            if (label) participant.label = label;
            if (type !== 'participant') participant.type = type;
            if (order !== undefined) participant.order = order;
            if (color) participant.color = color;
            if (stereotype) participant.stereotype = stereotype;
        }
        this.groupStack.forEach(g => {
            if (!g.participants.includes(name)) g.participants.push(name);
        });
    }

    addMessage(from: string, to: string, text: string, type: 'arrow' | 'dotted' = 'arrow', arrowHead: ArrowHead = 'default', color?: string, bidirectional?: boolean, startHead: ArrowHead = 'none', arrowDelay?: number) {
        const step = this.currentStep++;
        this.addParticipant(from);
        this.addParticipant(to);

        let msgNumber: string | undefined;
        if (this.autonumberConfig && !this.autonumberStopped) {
            // Increment the last segment
            this.currentAutonumbers[this.currentAutonumbers.length - 1] += this.autonumberConfig.increment;

            // Format the number
            const rawNumber = this.currentAutonumbers.join(this.autonumberDelimiter);
            if (this.autonumberConfig.format) {
                msgNumber = this.autonumberConfig.format.replace(/%d/g, rawNumber);
            } else {
                msgNumber = rawNumber;
            }
        }

        // Replace %autonumber% in the text itself (literally)
        const rawNum = this.currentAutonumbers.join(this.autonumberDelimiter);
        text = text.replace(/%autonumber%/g, rawNum);

        // Then decode all Unicode escapes like <U+XXXX>
        text = decodeUnicode(text);

        this.messages.push({ from, to, text, type, step, arrowHead, startHead, color, bidirectional, number: msgNumber, arrowDelay });

        if (this.autoactivateEnabled && from !== to && type === 'arrow') {
            this.activate(to, step, step);
        }

        return step;
    }

    setAutonumber(start: number | string = 1, increment: number = 1, format?: string) {
        this.autonumberConfig = { start: typeof start === 'number' ? start : 1, increment, format };
        this.autonumberStopped = false;

        if (typeof start === 'string') {
            const parts = start.split(/([.,;:])/);
            if (parts.length > 1) {
                this.autonumberDelimiter = parts[1];
                this.currentAutonumbers = parts.filter((_, i) => i % 2 === 0).map(p => parseInt(p, 10));
            } else {
                this.currentAutonumbers = [parseInt(start, 10)];
            }
        } else {
            this.currentAutonumbers = [start];
        }

        // We subtract the increment because addMessage will add it before using it
        this.currentAutonumbers[this.currentAutonumbers.length - 1] -= increment;
    }

    incrementAutonumberLevel(level: string) {
        if (!this.autonumberConfig) return;

        const index = level.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
        if (index >= 0 && index < this.currentAutonumbers.length) {
            this.currentAutonumbers[index]++;
            // Reset lower levels to 1
            for (let i = index + 1; i < this.currentAutonumbers.length; i++) {
                this.currentAutonumbers[i] = 1;
            }
            // Reset the last level such that the next message increment makes it correct
            // If the last level was reset to 1, we set it to 1 - increment
            this.currentAutonumbers[this.currentAutonumbers.length - 1] -= this.autonumberConfig.increment;
        }
    }

    stopAutonumber() {
        this.autonumberStopped = true;
    }

    resumeAutonumber(increment?: number, format?: string) {
        if (this.autonumberConfig) {
            this.autonumberStopped = false;
            if (increment !== undefined) this.autonumberConfig.increment = increment;
            if (format !== undefined) this.autonumberConfig.format = format;
        } else {
            this.setAutonumber(1, increment || 1, format);
        }
    }

    setAutoactivate(enabled: boolean) {
        this.autoactivateEnabled = enabled;
    }

    destroy(name: string, step?: number) {
        const participant = this.participants.find(p => p.name === name);
        if (participant) {
            participant.destroyedStep = step !== undefined ? step : this.currentStep++;
            this.deactivate(name, participant.destroyedStep);
        }
    }

    create(name: string, step: number) {
        let participant = this.participants.find(p => p.name === name);
        if (participant) {
            participant.createdStep = step;
        }
    }

    addDivider(label: string) {
        this.dividers.push({ label, step: this.currentStep++ });
    }

    rewindStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
        }
    }

    nextStep(): number {
        return this.currentStep++;
    }

    getCurrentStep(): number {
        return this.currentStep;
    }

    addDelay(text?: string) {
        this.delays.push({ text, step: this.currentStep++ });
    }

    addSpacing(height: number = 30) {
        this.spacings.push({ height, step: this.currentStep++ });
    }

    setTitle(title: string) { this.title = title; }
    setHeader(header: string) { this.header = header; }
    setFooter(footer: string) { this.footer = footer; }

    returnMessage(text: string) {
        // Find the most recent unfinished activation
        const lastActive = [...this.activations].reverse().find(a => a.endStep === undefined);
        if (!lastActive) return;

        const from = lastActive.participantName;
        let to = from; // Default to self if no source found

        if (lastActive.sourceStep !== undefined) {
            const sourceMsg = this.messages.find(m => m.step === lastActive.sourceStep);
            if (sourceMsg) {
                to = sourceMsg.from;
            }
        }

        const step = this.addMessage(from, to, text, 'dotted', 'open');
        this.deactivate(from, step);
    }

    addNote(text: string, position: 'left' | 'right' | 'over' | 'across', participants: string[], color?: string, shape: 'rectangle' | 'hexagon' | 'bubble' | 'folder' = 'folder', step?: number) {
        const noteStep = step !== undefined ? step : this.currentStep++;
        const owner = this.groupStack.length > 0 ? this.groupStack[this.groupStack.length - 1] : undefined;

        const rawNumber = this.currentAutonumbers.join(this.autonumberDelimiter);

        // Replace %autonumber% literally
        text = text.replace(/%autonumber%/g, rawNumber);

        // Then decode all Unicode escapes
        text = decodeUnicode(text);

        this.notes.push({
            text,
            position,
            participants,
            step: noteStep,
            color,
            shape,
            owner
        });
        return noteStep;
    }

    activate(name: string, step: number = this.currentStep, sourceStep?: number, color?: string) {
        this.addParticipant(name);
        const activeCount = this.activations.filter(a => a.participantName === name && a.endStep === undefined).length;
        this.activations.push({
            participantName: name,
            startStep: step,
            level: activeCount,
            sourceStep,
            color
        });
    }

    deactivate(name: string, step: number = this.currentStep, sourceStep?: number) {
        this.addParticipant(name);
        // Find the most recent unfinished activation
        const lastActive = [...this.activations].reverse().find(a => a.participantName === name && a.endStep === undefined);
        if (lastActive) {
            lastActive.endStep = step;
            lastActive.endSourceStep = sourceStep;
        }
    }

    startGroup(type: string, label: string) {
        const step = type === 'box' ? this.currentStep : this.nextStep();
        const group: Group = {
            type,
            label,
            startStep: step,
            sections: [],
            level: this.groupStack.length,
            participants: []
        };
        this.groups.push(group);
        this.groupStack.push(group);
        return group;
    }

    addGroupSection(label: string, color?: string) {
        const group = this.groupStack[this.groupStack.length - 1];
        if (group) {
            group.sections.push({ label, startStep: this.nextStep(), color });
        }
    }

    endGroup() {
        const group = this.groupStack.pop();
        if (group) {
            group.endStep = group.type === 'box' ? this.currentStep : this.nextStep();
        }
    }

    addReference(participants: string[], label: string) {
        const startStep = this.nextStep();
        const endStep = this.nextStep();
        this.references.push({ participants, label, startStep, endStep });
    }

    addTaggedStep(tag: string, step: number) {
        this.taggedSteps.set(tag, step);
    }

    addTimeConstraint(startTag: string, endTag: string, label: string) {
        this.timeConstraints.push({ startTag, endTag, label });
    }
}
