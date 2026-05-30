import { SequenceDiagram, Note, Participant, Message, Activation, Group, Reference, ArrowHead } from './SequenceDiagram';
import { SequenceTheme } from './SequenceTheme';

export interface ParsedStereotype {
    spotChar?: string;
    spotColor?: string;
    text?: string;
}

export function parseStereotype(stereo: string | undefined): ParsedStereotype | null {
    if (!stereo) return null;
    const trimmed = stereo.trim();
    const spotMatch = trimmed.match(/^\(([^,]+),([^)]+)\)\s*(.*)$/);
    if (spotMatch) {
        return {
            spotChar: spotMatch[1].trim(),
            spotColor: spotMatch[2].trim(),
            text: spotMatch[3].trim()
        };
    }
    return {
        text: trimmed
    };
}

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ParticipantLayout extends Rect {
    participant: Participant;
    centerX: number;
    destroyedY?: number;
}

export interface NoteLayout extends Rect {
    note: Note;
}

export interface MessageLayout {
    message: Message;
    y: number;
    points: Point[]; // For polyline/path
    labelPosition: Point;
    markerEnd?: string;
    markerStart?: string;
    lineStyle: 'solid' | 'dashed';
}

export interface GroupLayout {
    group: Group;
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
    label?: string;
    sections: { label: string; y: number; color?: string }[];
    color?: string;
    headerColor?: string;
}

export interface ActivationLayout extends Rect {
    activation: Activation;
}

export interface DividerLayout {
    y: number;
    label?: string;
}

export interface ReferenceLayout extends Rect {
    reference: Reference;
}

export interface DelayLayout {
    y: number;
    text?: string;
}

export interface TimeConstraintLayout {
    x: number;
    startY: number;
    endY: number;
    label: string;
}

export interface LayoutResult {
    width: number;
    height: number;
    participants: ParticipantLayout[];
    notes: NoteLayout[];
    messages: MessageLayout[];
    groups: GroupLayout[];
    activations: ActivationLayout[];
    dividers: DividerLayout[];
    references: ReferenceLayout[];
    delays: DelayLayout[];
    timeConstraints: TimeConstraintLayout[];
}

export class LayoutEngine {
    constructor(private theme: SequenceTheme) { }

    calculateLayout(diagram: SequenceDiagram): LayoutResult {
        // Sort participants (excluding pseudo-participants [, ], ?)
        const participants = [...diagram.participants]
            .filter(p => p.name !== '[' && p.name !== ']' && p.name !== '?')
            .sort((a, b) => {
                if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
                if (a.order !== undefined) return -1;
                if (b.order !== undefined) return 1;
                return 0;
            });

        const maxStep = this.calculateMaxStep(diagram);
        this.finalizeEndSteps(diagram, maxStep);

        const hasBoxWithLabel = diagram.groups.some(g => g.type === 'box' && g.label);
        let participantYStart = this.theme.padding;
        if (hasBoxWithLabel) {
            participantYStart += 25;
        }
        if (diagram.title) {
            participantYStart = Math.max(participantYStart, 55 + (hasBoxWithLabel ? 25 : 0));
        } else if (diagram.header) {
            participantYStart = Math.max(participantYStart, 35 + (hasBoxWithLabel ? 25 : 0));
        }

        let bottomPadding = this.theme.padding;
        if (diagram.footer) {
            bottomPadding += 25; // Space for footer
        }

        const pHeights = participants.map(p => this.calculateParticipantHeight(p));
        const maxPHeight = Math.max(this.theme.participantHeight, ...pHeights);

        const stepHeightResult = this.calculateStepHeights(diagram, maxStep, participantYStart, maxPHeight);
        const stepY = stepHeightResult.stepY;
        const currentY = stepHeightResult.totalHeight;

        // Horizontal Layout
        const pWidths = participants.map(p => this.calculateParticipantWidth(p));
        const gaps = this.calculateGaps(diagram, participants, pWidths);

        const relpCenterX = this.calculateRelativepCenterXs(participants, pWidths, gaps);

        // Note Layout Config (Pre, Relative)
        const noteLayoutsMap = this.preCalculateNoteLayouts(diagram, participants, relpCenterX, pWidths, stepY);

        const bounds = this.calculateBounds(participants, relpCenterX, pWidths, noteLayoutsMap, diagram.messages, diagram.groups);

        const offsetX = this.theme.padding - bounds.minX;
        const baseWidth = (bounds.maxX - bounds.minX) + this.theme.padding * 2;
        let totalWidth = baseWidth;

        // Add space for time constraints if they exist
        if (diagram.timeConstraints.length > 0) {
            const maxLabelLength = Math.max(...diagram.timeConstraints.map(tc => tc.label.length), 0);
            const timeConstraintSpace = 50 + (maxLabelLength * 8); // 50px for arrow + label width
            totalWidth += timeConstraintSpace;
        }

        const footboxHeight = diagram.hideFootbox ? 0 : maxPHeight + 20;
        const totalHeight = currentY + footboxHeight + bottomPadding;

        // Finalize X positions
        const participantLayouts: ParticipantLayout[] = participants.map((p, i) => {
            const centerX = relpCenterX[i] + offsetX;
            return {
                participant: p,
                centerX: centerX,
                x: centerX - pWidths[i] / 2,
                y: p.createdStep !== undefined ? stepY[p.createdStep] - maxPHeight / 2 : participantYStart,
                width: pWidths[i],
                height: maxPHeight,
                destroyedY: p.destroyedStep !== undefined ? stepY[p.destroyedStep] : undefined
            };
        });

        // Finalize Note X
        const finalNoteLayouts: NoteLayout[] = [];
        noteLayoutsMap.forEach((layout, note) => {
            let x = layout.x + offsetX;
            let w = layout.width;
            if (note.position === 'across') {
                x = this.theme.padding;
                w = Math.max(baseWidth - this.theme.padding * 2, layout.width);
            }
            finalNoteLayouts.push({
                note,
                x,
                y: layout.y,
                width: w,
                height: layout.height
            });
        });

        // Groups
        const groupLayouts: GroupLayout[] = this.calculateGroupLayouts(diagram, participantLayouts, finalNoteLayouts, stepY, maxStep, participantYStart, totalHeight, bottomPadding);

        // Calculate activations BEFORE messages so we can use them for self-message positioning
        const activationLayouts = this.calculateActivationLayouts(diagram, participantLayouts, stepY, diagram.messages);

        return {
            width: totalWidth,
            height: totalHeight,
            participants: participantLayouts,
            notes: finalNoteLayouts,
            dividers: this.calculateDividerLayouts(diagram, stepY, totalWidth),
            references: this.calculateReferenceLayouts(diagram, participantLayouts, stepY),
            messages: this.calculateMessageLayouts(diagram, participantLayouts, stepY, activationLayouts),
            groups: groupLayouts,
            activations: activationLayouts,
            delays: this.calculateDelayLayouts(diagram, stepY),
            timeConstraints: this.calculateTimeConstraintLayouts(diagram, participantLayouts, stepY, baseWidth)
        };
    }

    private calculateMessageLayouts(diagram: SequenceDiagram, participants: ParticipantLayout[], stepY: number[], activations: ActivationLayout[]): MessageLayout[] {
        const leftmostParticipant = participants[0];
        const rightmostParticipant = participants[participants.length - 1];

        return diagram.messages.map(m => {
            const fromIdx = participants.findIndex(p => p.participant.name === m.from);
            const toIdx = participants.findIndex(p => p.participant.name === m.to);
            const y = stepY[m.step];

            // Default center positions
            let x1 = 0;
            if (fromIdx !== -1) {
                x1 = participants[fromIdx].centerX;
            } else if (m.from === '[') {
                x1 = leftmostParticipant ? leftmostParticipant.centerX - 80 : 50;
            } else if (m.from === ']') {
                x1 = rightmostParticipant ? rightmostParticipant.centerX + 80 : 150;
            } else if (m.from === '?') {
                const toX = toIdx !== -1 ? participants[toIdx].centerX : 100;
                x1 = toX - 50;
            }

            let x2 = 0;
            if (toIdx !== -1) {
                x2 = participants[toIdx].centerX;
            } else if (m.to === ']') {
                x2 = rightmostParticipant ? rightmostParticipant.centerX + 80 : 150;
            } else if (m.to === '[') {
                x2 = leftmostParticipant ? leftmostParticipant.centerX - 80 : 50;
            } else if (m.to === '?') {
                const fromX = fromIdx !== -1 ? participants[fromIdx].centerX : 50;
                x2 = fromX + 50;
            }

            // Adjust x1 and x2 based on activations
            if (fromIdx !== -1 || toIdx !== -1) {
                // Find active activations for "from" and "to" at this step
                const fromActivations = fromIdx !== -1 ? activations
                    .filter(a => a.activation.participantName === m.from && a.activation.startStep <= m.step && (a.activation.endStep ?? Infinity) >= m.step)
                    .sort((a, b) => b.activation.level - a.activation.level) : [];

                const toActivations = toIdx !== -1 ? activations
                    .filter(a => a.activation.participantName === m.to && a.activation.startStep <= m.step && (a.activation.endStep ?? Infinity) >= m.step)
                    .sort((a, b) => b.activation.level - a.activation.level) : [];

                if (fromIdx !== toIdx) {
                    // Regular message (not self)
                    const isLeftToRight = (fromIdx !== -1 && toIdx !== -1)
                        ? (fromIdx < toIdx)
                        : true;

                    if (isLeftToRight) {
                        // Left to Right
                        if (fromActivations.length > 0) {
                            x1 = fromActivations[0].x + fromActivations[0].width;
                        }
                        if (toActivations.length > 0) {
                            x2 = toActivations[0].x;
                        }
                    } else {
                        // Right to Left
                        if (fromActivations.length > 0) {
                            x1 = fromActivations[0].x;
                        }
                        if (toActivations.length > 0) {
                            x2 = toActivations[0].x + toActivations[0].width;
                        }
                    }
                }
            }

            // If this is a create message (target participant created at this step),
            // point to the left edge of the participant box, not center
            if (toIdx !== -1 && participants[toIdx].participant.createdStep === m.step) {
                x2 = participants[toIdx].x; // Left edge
            }

            const isHead = (h?: ArrowHead) => h && ['default', 'open', 'half', 'arrow-circle'].includes(h);
            const isReverse = isHead(m.startHead) && !isHead(m.arrowHead);

            const delay = m.arrowDelay || 0;
            let y1 = y;
            let y2 = y;
            if (delay > 0) {
                if (isReverse) {
                    y1 = y + delay;
                } else {
                    y2 = y + delay;
                }
            }

            const points: Point[] = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
            let labelPosition = { x: (x1 + x2) / 2, y: y + delay / 2 };

            if (fromIdx === toIdx && fromIdx !== -1) {
                // Self-message: find the active activation at this step
                const activeActivations = activations
                    .filter(a =>
                        a.activation.participantName === m.from &&
                        a.activation.startStep <= m.step &&
                        (a.activation.endStep ?? Infinity) >= m.step
                    )
                    .sort((a, b) => b.activation.level - a.activation.level); // Highest level first

                // For self-messages, we need to consider if this message IS the trigger for a level change
                // If m.step is exactly the startStep of the highest activation, then it's a level increase (++)
                // If it's a level increase, the start of the arrow (points[0]) should be at level N-1,
                // and the end of the arrow (points[3]) should be at level N.

                let startLevelIdx: number | undefined = 0;
                let endLevelIdx: number | undefined = 0;

                if (activeActivations.length > 0) {
                    const highest = activeActivations[0];
                    if (highest.activation.startStep === m.step) {
                        // Level increase (++)
                        if (activeActivations.length > 1) {
                            startLevelIdx = 1; // Parent level
                            endLevelIdx = 0;   // New level
                        } else {
                            // First level increase: start from center
                            startLevelIdx = undefined;
                            endLevelIdx = 0;
                        }
                    } else if (highest.activation.endStep === m.step) {
                        // Level decrease (--)
                        if (activeActivations.length > 1) {
                            startLevelIdx = 0; // Current level
                            endLevelIdx = 1;   // Parent level
                        } else {
                            // Last level decrease: end at center
                            startLevelIdx = 0;
                            endLevelIdx = undefined;
                        }
                    }

                    const baseXStart = (startLevelIdx !== undefined && activeActivations.length > startLevelIdx)
                        ? activeActivations[startLevelIdx].x + activeActivations[startLevelIdx].width
                        : participants[fromIdx].centerX;

                    const baseXEnd = (endLevelIdx !== undefined && activeActivations.length > endLevelIdx)
                        ? activeActivations[endLevelIdx].x + activeActivations[endLevelIdx].width
                        : participants[fromIdx].centerX;

                    const diff = 40;
                    points[0] = { x: baseXStart, y };
                    points[1] = { x: Math.max(baseXStart, baseXEnd) + diff, y };
                    points.push({ x: Math.max(baseXStart, baseXEnd) + diff, y: y + 25 + delay });
                    points.push({ x: baseXEnd, y: y + 25 + delay });
                    labelPosition = { x: Math.max(baseXStart, baseXEnd) + diff + 5, y: y + 10 + delay / 2 };
                } else {
                    // No activation, use participant center
                    const baseX = participants[fromIdx].centerX;
                    const diff = 40;
                    points[0] = { x: baseX, y };
                    points[1] = { x: baseX + diff, y };
                    points.push({ x: baseX + diff, y: y + 25 + delay });
                    points.push({ x: baseX, y: y + 25 + delay });
                    labelPosition = { x: baseX + diff + 5, y: y + 10 + delay / 2 };
                }
            }

            return {
                message: m,
                y,
                points,
                labelPosition,
                lineStyle: m.type === 'dotted' ? 'dashed' : 'solid'
            };
        });
    }

    private calculateDividerLayouts(diagram: SequenceDiagram, stepY: number[], totalWidth: number): DividerLayout[] {
        return diagram.dividers.map(d => ({
            y: stepY[d.step],
            label: d.label
        }));
    }

    private calculateDelayLayouts(diagram: SequenceDiagram, stepY: number[]): DelayLayout[] {
        return diagram.delays.map(d => ({
            y: stepY[d.step],
            text: d.text
        }));
    }

    private calculateTimeConstraintLayouts(diagram: SequenceDiagram, participants: ParticipantLayout[], stepY: number[], totalWidth: number): TimeConstraintLayout[] {
        return diagram.timeConstraints.map(tc => {
            const startStep = diagram.taggedSteps.get(tc.startTag);
            const endStep = diagram.taggedSteps.get(tc.endTag);

            if (startStep === undefined || endStep === undefined) {
                return null;
            }

            return {
                x: totalWidth - this.theme.padding + 20, // Position to the right of the diagram
                startY: stepY[startStep],
                endY: stepY[endStep],
                label: tc.label
            };
        }).filter(tc => tc !== null) as TimeConstraintLayout[];
    }

    private calculateReferenceLayouts(diagram: SequenceDiagram, participants: ParticipantLayout[], stepY: number[]): ReferenceLayout[] {
        return diagram.references.map(r => {
            const pIdxs = r.participants.map(name => participants.findIndex(pl => pl.participant.name === name)).filter(i => i !== -1);
            if (pIdxs.length === 0) return null;
            const minIdx = Math.min(...pIdxs);
            const maxIdx = Math.max(...pIdxs);
            const x = participants[minIdx].x; // Start of first participant box
            const w = (participants[maxIdx].x + participants[maxIdx].width) - x;
            const y = stepY[r.startStep] - 10;
            const h = stepY[r.endStep!] - y;
            return {
                reference: r,
                x, y, width: w, height: h
            };
        }).filter(r => r !== null) as ReferenceLayout[];
    }

    private calculateActivationLayouts(diagram: SequenceDiagram, participants: ParticipantLayout[], stepY: number[], messages: Message[]): ActivationLayout[] {
        const isHead = (h?: ArrowHead) => h && ['default', 'open', 'half', 'arrow-circle'].includes(h);

        return diagram.activations.map(a => {
            const pIdx = participants.findIndex(p => p.participant.name === a.participantName);
            if (pIdx === -1) return null;

            const p = participants[pIdx];
            const x = p.centerX - (this.theme.activationWidth / 2) + (a.level * 5);
            let y = stepY[a.startStep];

            if (a.sourceStep !== undefined) {
                const triggerMsg = messages.find(m => m.step === a.sourceStep);
                if (triggerMsg) {
                    const delay = triggerMsg.arrowDelay || 0;
                    if (triggerMsg.from === a.participantName && triggerMsg.to === a.participantName) {
                        y += 25 + delay;
                    } else {
                        const isReverse = isHead(triggerMsg.startHead) && !isHead(triggerMsg.arrowHead);
                        const endsAtParticipant = (!isReverse && triggerMsg.to === a.participantName) || (isReverse && triggerMsg.from === a.participantName);
                        if (endsAtParticipant) {
                            y += delay;
                        }
                    }
                }
            }
            let yEnd = stepY[a.endStep!];
            if (a.endSourceStep !== undefined) {
                const closeMsg = messages.find(m => m.step === a.endSourceStep);
                if (closeMsg) {
                    const delay = closeMsg.arrowDelay || 0;
                    if (closeMsg.from === a.participantName && closeMsg.to === a.participantName) {
                        yEnd += 25 + delay;
                    } else {
                        const isReverse = isHead(closeMsg.startHead) && !isHead(closeMsg.arrowHead);
                        const endsAtParticipant = (!isReverse && closeMsg.to === a.participantName) || (isReverse && closeMsg.from === a.participantName);
                        if (endsAtParticipant) {
                            yEnd += delay;
                        }
                    }
                }
            }

            const minHeight = 5; // Minimum height to ensure activation is visible
            const height = Math.max(minHeight, yEnd - y);
            return {
                activation: a,
                x, y, width: this.theme.activationWidth, height
            };
        }).filter(a => a !== null) as ActivationLayout[];
    }

    // ... Helper methods (implementation details moved from Renderer) ...

    private calculateMaxStep(diagram: SequenceDiagram): number {
        let maxStep = 0;
        const allElements = [
            ...diagram.messages,
            ...diagram.activations,
            ...diagram.groups,
            ...diagram.references,
            ...diagram.notes,
            ...diagram.dividers,
            ...diagram.delays,
            ...diagram.spacings
        ];
        allElements.forEach(e => {
            const s1 = (e as any).step ?? 0;
            const s2 = (e as any).startStep ?? 0;
            const s3 = (e as any).endStep ?? 0;
            const s = Math.max(s1, s2, s3);
            if (s > maxStep) maxStep = s;
        });
        return maxStep + 1;
    }

    private finalizeEndSteps(diagram: SequenceDiagram, maxStep: number) {
        diagram.activations.forEach(a => { if (a.endStep === undefined) a.endStep = maxStep; });
        diagram.groups.forEach(g => { if (g.endStep === undefined) g.endStep = maxStep; });
    }

    private calculateStepHeights(diagram: SequenceDiagram, maxStep: number, participantYStart: number, maxPHeight: number) {
        const stepHeights = new Array(maxStep + 1).fill(this.theme.defaultMessageGap);
        const topExtension = new Array(maxStep + 2).fill(0);
        const bottomExtension = new Array(maxStep + 2).fill(0);

        diagram.notes.forEach(n => {
            const lines = n.text.split('\n');
            const noteHeight = lines.length * 20 + 10;
            // Center the note at the step height, regardless of whether there's a message
            topExtension[n.step] = Math.max(topExtension[n.step], noteHeight / 2);
            bottomExtension[n.step] = Math.max(bottomExtension[n.step], noteHeight / 2);
        });

        diagram.messages.forEach(m => {
            const hasText = m.text && m.text.trim() !== '';
            const lines = hasText ? m.text.split('\n') : [];
            const textLines = lines.length;
            const delay = m.arrowDelay || 0;
            if (m.from === m.to) {
                const loopHeight = Math.max(25, textLines * 20);
                topExtension[m.step] = Math.max(topExtension[m.step], 0);
                bottomExtension[m.step] = Math.max(bottomExtension[m.step], loopHeight + 10 + delay);
            } else {
                const textHeight = hasText ? textLines * 15 + 5 : 0;
                topExtension[m.step] = Math.max(topExtension[m.step], textHeight);
                bottomExtension[m.step] = Math.max(bottomExtension[m.step], delay);
            }
        });

        // Group top and bottom extensions
        const maxGroupLevel = diagram.groups.length > 0 ? Math.max(...diagram.groups.map(g => g.level)) : 0;
        diagram.groups.forEach(g => {
            if (g.type === 'box') return;
            const levelOffset = (maxGroupLevel - g.level);
            const vPaddingTop = 25 + levelOffset * 8;
            const vPaddingBottom = 5 + levelOffset * 8;

            topExtension[g.startStep] = Math.max(topExtension[g.startStep], vPaddingTop);
            if (g.endStep !== undefined) {
                bottomExtension[g.endStep] = Math.max(bottomExtension[g.endStep], vPaddingBottom);
            }
        });

        const baseHeights = new Array(maxStep + 1).fill(this.theme.defaultMessageGap);
        if (maxStep > 0) {
            baseHeights[maxStep - 1] = 40; // Compact spacing for the last step before the footbox
        }

        // Apply compact spacing (baseHeight = 20) for all steps containing messages (with or without labels)
        for (let i = 0; i <= maxStep; i++) {
            const stepMessages = diagram.messages.filter(m => m.step === i);
            if (stepMessages.length > 0) {
                baseHeights[i] = 20;
            }
        }
        diagram.dividers.forEach(d => { baseHeights[d.step] = 30; });
        diagram.delays.forEach(d => { baseHeights[d.step] = 40; });
        diagram.spacings.forEach(s => { baseHeights[s.step] = s.height; });
        diagram.references.forEach(r => {
            const lines = r.label.split('\n');
            const textHeight = lines.length * 15 + 40; // Approx height for ref with header
            // A ref spans from startStep to endStep.
            // We need to ensure the TOTAL height between startStep and endStep is at least textHeight.
            // Since endStep = startStep + 1 usually (from addReference implementation), 
            // we can enforce the gap of startStep to be large enough.
            if (r.endStep === r.startStep + 1) {
                baseHeights[r.startStep] = Math.max(baseHeights[r.startStep], textHeight);
            }
        });

        const isGroupStartStep = (step: number) => {
            return diagram.groups.some(g => g.type !== 'box' && g.startStep === step);
        };
        const isGroupEndStep = (step: number) => {
            return diagram.groups.some(g => g.type !== 'box' && g.endStep === step);
        };

        for (let i = 0; i <= maxStep; i++) {
            let margin = 10;
            if (isGroupStartStep(i + 1)) {
                margin = Math.max(margin, 25);
            }
            if (isGroupEndStep(i)) {
                margin = Math.max(margin, 20);
            }
            const requiredGap = bottomExtension[i] + topExtension[i + 1] + margin;
            stepHeights[i] = Math.max(baseHeights[i], requiredGap);
        }

        const stepY = new Array(maxStep + 1).fill(0);
        const headerGap = Math.max(30, topExtension[0] + 10);
        let currentY = participantYStart + maxPHeight + headerGap;
        for (let i = 0; i <= maxStep; i++) {
            stepY[i] = currentY;
            currentY += stepHeights[i];
        }

        return { stepY, totalHeight: stepY[maxStep] };
    }

    private calculateParticipantWidth(p: Participant): number {
        const label = (p.label || p.name).replace(/\\n/g, '\n');
        const lines = label.split('\n');
        let maxLineLength = Math.max(...lines.map(l => l.length));
        
        let minWidth = this.theme.participantWidth;
        let textWidth = maxLineLength * 9 + 30;

        if (p.stereotype) {
            const parsed = parseStereotype(p.stereotype);
            if (parsed) {
                let stereoText = '';
                if (parsed.text) {
                    stereoText = `«${parsed.text}»`;
                }
                let stereoWidth = stereoText.length * 8 + 30;
                if (parsed.spotChar) {
                    stereoWidth += 22;
                }
                textWidth = Math.max(textWidth, stereoWidth);
            }
        }

        return Math.max(minWidth, textWidth);
    }

    private calculateParticipantHeight(p: Participant): number {
        if (p.stereotype) {
            return 60;
        }
        return this.theme.participantHeight;
    }

    // Simplified gap calculation for brevity in this first pass
    private calculateGaps(diagram: SequenceDiagram, participants: Participant[], pWidths: number[]): number[] {
        const numGaps = Math.max(0, participants.length - 1);
        const gaps = new Array(numGaps).fill(60);
        const maxStep = this.calculateMaxStep(diagram);

        // 1. Handle localized requirements per step and per participant (Notes & Self-messages)
        for (let s = 0; s <= maxStep; s++) {
            const gapRequirements = new Array(numGaps).fill(0);

            for (let i = 0; i < participants.length; i++) {
                const name = participants[i].name;
                const participant = participants[i];

                // Check if this participant is created at this step
                // If so, we need space for the participant box on the right side
                if (participant.createdStep === s) {
                    const boxWidth = pWidths[i];
                    // Add space for the created participant box
                    if (i < numGaps) {
                        gapRequirements[i] = Math.max(gapRequirements[i], boxWidth / 2 + 20);
                    }
                }

                // Right side of P_i
                let rightSpace = 15;
                const selfMsg = diagram.messages.find(m => m.step === s && m.from === name && m.to === name);
                if (selfMsg) {
                    const textWidth = Math.max(...selfMsg.text.split('\n').map(l => l.length * 8)) + 20;
                    rightSpace = 40 + textWidth + 10;
                }
                const activeAlt = diagram.activations.filter(a => a.participantName === name && a.startStep <= s && (a.endStep ?? Infinity) >= s);
                if (activeAlt.length > 0) {
                    const maxL = Math.max(...activeAlt.map(a => a.level));
                    rightSpace = Math.max(rightSpace, (this.theme.activationWidth / 2) + (maxL * 5) + 10);
                }
                const notesR = diagram.notes.filter(n => n.step === s && n.position === 'right' && n.participants?.includes(name));
                notesR.forEach(n => {
                    const w = Math.max(60, Math.max(...n.text.split('\n').map(l => l.length * 8.5)) + 20);
                    rightSpace += w + 10;
                });

                if (i < numGaps) gapRequirements[i] += rightSpace;

                // Left side of P_i
                let leftSpace = 15;
                const notesL = diagram.notes.filter(n => n.step === s && n.position === 'left' && n.participants?.includes(name));
                notesL.forEach(n => {
                    const w = Math.max(60, Math.max(...n.text.split('\n').map(l => l.length * 8.5)) + 20);
                    leftSpace += w + 10;
                });

                if (i > 0) gapRequirements[i - 1] += leftSpace;
            }

            for (let g = 0; g < numGaps; g++) {
                gaps[g] = Math.max(gaps[g], gapRequirements[g]);
            }
        }

        // 2. Handle cross-participant messages
        diagram.messages.forEach(m => {
            const fIdx = participants.findIndex(p => p.name === m.from);
            const tIdx = participants.findIndex(p => p.name === m.to);
            if (fIdx === -1 || tIdx === -1 || fIdx === tIdx) return;

            const textWidth = Math.max(...m.text.split('\n').map(l => l.length * 8)) + 20;
            const s = Math.min(fIdx, tIdx);
            const e = Math.max(fIdx, tIdx);
            let currentSpace = 0;
            for (let k = s; k < e; k++) {
                currentSpace += pWidths[k] / 2 + gaps[k] + pWidths[k + 1] / 2;
            }
            if (currentSpace < textWidth) {
                const deficit = textWidth - currentSpace;
                const increment = deficit / (e - s);
                for (let k = s; k < e; k++) gaps[k] += increment;
            }
        });

        // 3. Handle over/across notes
        diagram.notes.forEach(n => {
            if (n.position !== 'over' && n.position !== 'across') return;
            const lines = n.text.split('\n');
            const noteWidth = Math.max(60, Math.max(...lines.map(l => l.length * 8.5)) + 20);

            if (n.participants && n.participants.length > 0) {
                const sIdx = participants.findIndex(p => p.name === n.participants![0]);
                const eIdx = n.participants.length > 1 ? participants.findIndex(p => p.name === n.participants![1]) : sIdx;
                if (sIdx === -1 || eIdx === -1) return;

                const s = Math.min(sIdx, eIdx);
                const e = Math.max(sIdx, eIdx);
                if (s === e) {
                    const required = noteWidth / 2 + 10;
                    if (s < numGaps) {
                        if (gaps[s] < required) gaps[s] = required;
                    }
                    // Note: if s is last participant, calculateBounds handles it
                } else {
                    let currentSpace = 0;
                    for (let k = s; k < e; k++) {
                        currentSpace += pWidths[k] / 2 + gaps[k] + pWidths[k + 1] / 2;
                    }
                    if (currentSpace < noteWidth) {
                        const deficit = noteWidth - currentSpace;
                        const increment = deficit / (e - s);
                        for (let k = s; k < e; k++) gaps[k] += increment;
                    }
                }
            }
        });

        return gaps;
    }

    private calculateRelativepCenterXs(participants: Participant[], pWidths: number[], gaps: number[]): number[] {
        const relpCenterX = new Array(participants.length).fill(0);
        participants.forEach((p, i) => {
            if (i === 0) {
                relpCenterX[i] = pWidths[i] / 2;
            } else {
                relpCenterX[i] = relpCenterX[i - 1] + pWidths[i - 1] / 2 + gaps[i - 1] + pWidths[i] / 2;
            }
        });
        return relpCenterX;
    }

    private preCalculateNoteLayouts(diagram: SequenceDiagram, participants: Participant[], relpCenterX: number[], pWidths: number[], stepY: number[]) {
        const noteLayouts = new Map<Note, { x: number, y: number, width: number, height: number }>();
        const stepOccupancy = new Map<string, number>();

        diagram.notes.forEach(note => {
            const lines = note.text.split('\n');
            const calculatedWidth = Math.max(...lines.map(l => l.length * 8.5)) + 20;
            const minWidth = 60;
            const noteWidth = Math.max(calculatedWidth, minWidth);
            const noteHeight = lines.length * 20 + 10;
            // Align the note center with the step Y (where the arrow is)
            const y = stepY[note.step] - (noteHeight / 2);
            let x = 0;

            if (note.position === 'across') {
                x = 0; // Placeholder
                noteLayouts.set(note, { x, y, width: noteWidth, height: noteHeight });
            } else if (note.position === 'over') {
                const pIdxs = note.participants!.map(name => participants.findIndex(p => p.name === name)).filter(i => i !== -1);
                if (pIdxs.length > 0) {
                    const minIdx = Math.min(...pIdxs);
                    const maxIdx = Math.max(...pIdxs);
                    const baseWidth = (relpCenterX[maxIdx] + pWidths[maxIdx] / 2) - (relpCenterX[minIdx] - pWidths[minIdx] / 2);
                    const finalWidth = Math.max(baseWidth, noteWidth);
                    x = (relpCenterX[minIdx] - pWidths[minIdx] / 2) - (finalWidth - baseWidth) / 2;
                    noteLayouts.set(note, { x, y, width: finalWidth, height: noteHeight });
                }
            } else {
                const pIdxs = (note.participants || []).map(name => participants.findIndex(p => p.name === name)).filter(i => i !== -1);
                if (pIdxs.length > 0) {
                    const pIdx = note.position === 'left' ? Math.min(...pIdxs) : Math.max(...pIdxs);
                    const cx = relpCenterX[pIdx];
                    const key = `${note.step}-${pIdx}-${note.position}`;

                    const participant = participants[pIdx];
                    const halfWidth = pWidths[pIdx] / 2;
                    const isCreatedStep = note.step === participant.createdStep;
                    const effectiveBoxOffset = isCreatedStep ? halfWidth : 0;

                    if (note.position === 'left') {
                        const currentRightEdge = stepOccupancy.get(key) ?? (cx - effectiveBoxOffset - 5);
                        x = currentRightEdge - noteWidth;
                        stepOccupancy.set(key, x - 10);
                    } else {
                        // Check if there's a self-message at this step for this participant
                        const selfMessage = diagram.messages.find(m =>
                            m.step === note.step &&
                            m.from === participant.name &&
                            m.to === participant.name
                        );
                        let selfMsgRightOffset = 0;
                        if (selfMessage) {
                            const textLines = selfMessage.text.split('\n');
                            const textWidth = Math.max(...textLines.map(l => l.length * 8)) + 20;
                            selfMsgRightOffset = 40 + textWidth;
                        }

                        // Also account for activations
                        const activeAlt = diagram.activations.filter(a =>
                            a.participantName === participant.name &&
                            a.startStep <= note.step &&
                            (a.endStep ?? Infinity) >= note.step
                        );
                        const maxLevel = activeAlt.length > 0 ? Math.max(...activeAlt.map(a => a.level)) : 0;
                        const activationOffset = (this.theme.activationWidth / 2) + (maxLevel * 5);

                        const baseRight = Math.max(effectiveBoxOffset, activationOffset, selfMsgRightOffset);

                        const currentLeftEdge = stepOccupancy.get(key) ?? (cx + baseRight + 5);
                        x = currentLeftEdge;
                        stepOccupancy.set(key, x + noteWidth + 10);
                    }
                    noteLayouts.set(note, { x, y, width: noteWidth, height: noteHeight });
                }
            }
        });
        return noteLayouts;
    }

    private calculateBounds(participants: Participant[], relpCenterX: number[], pWidths: number[], noteLayouts: Map<Note, any>, messages: Message[], groups: Group[]) {
        let minX = 0;
        let maxX = 0;

        participants.forEach((p, i) => {
            const left = relpCenterX[i] - pWidths[i] / 2;
            const right = relpCenterX[i] + pWidths[i] / 2;
            if (i === 0) { minX = left; maxX = right; }
            else { if (left < minX) minX = left; if (right > maxX) maxX = right; }
        });

        noteLayouts.forEach(l => {
            if (l.x < minX) minX = l.x;
            if (l.x + l.width > maxX) maxX = l.x + l.width;
        });

        // Include group box boundaries in bounds calculation to prevent clipping at the left/right edges of the SVG
        const maxGroupLevel = groups.length > 0 ? Math.max(...groups.map(g => g.level)) : 0;
        groups.forEach(g => {
            const pIdxs = g.participants.map(name => participants.findIndex(p => p.name === name)).filter(i => i !== -1);
            if (pIdxs.length === 0) return;
            const minIdx = Math.min(...pIdxs);
            const maxIdx = Math.max(...pIdxs);

            const levelOffset = (maxGroupLevel - g.level);
            const hPadding = 10 + levelOffset * 10;

            const groupLeft = (relpCenterX[minIdx] - pWidths[minIdx] / 2) - hPadding;
            const groupRight = (relpCenterX[maxIdx] + pWidths[maxIdx] / 2) + hPadding;

            if (groupLeft < minX) minX = groupLeft;
            if (groupRight > maxX) maxX = groupRight;
        });

        messages.forEach(m => {
            const fromIdx = participants.findIndex(p => p.name === m.from);
            const toIdx = participants.findIndex(p => p.name === m.to);
            
            const textLines = m.text.split('\n');
            const textWidth = Math.max(...textLines.map(l => l.length * 8)) + 20; // simplified calc

            if (fromIdx !== -1 && fromIdx === toIdx) {
                const cx = relpCenterX[fromIdx];
                const rightBound = cx + 40 + textWidth + 10;
                if (rightBound > maxX) maxX = rightBound;
            } else {
                // Get horizontal coordinates similar to calculateMessageLayouts
                let x1 = 0;
                let x2 = 0;
                const leftmostParticipant = participants[0];
                const rightmostParticipant = participants[participants.length - 1];

                if (fromIdx !== -1) {
                    x1 = relpCenterX[fromIdx] || 0;
                } else if (m.from === '[') {
                    x1 = relpCenterX[0] !== undefined ? relpCenterX[0] - 80 : 50;
                } else if (m.from === ']') {
                    x1 = relpCenterX[relpCenterX.length - 1] !== undefined ? relpCenterX[relpCenterX.length - 1] + 80 : 150;
                } else if (m.from === '?') {
                    const toRelIdx = toIdx !== -1 ? toIdx : 0;
                    x1 = relpCenterX[toRelIdx] !== undefined ? relpCenterX[toRelIdx] - 50 : 50;
                }

                if (toIdx !== -1) {
                    x2 = relpCenterX[toIdx] || 0;
                } else if (m.to === ']') {
                    x2 = relpCenterX[relpCenterX.length - 1] !== undefined ? relpCenterX[relpCenterX.length - 1] + 80 : 150;
                } else if (m.to === '[') {
                    x2 = relpCenterX[0] !== undefined ? relpCenterX[0] - 80 : 50;
                } else if (m.to === '?') {
                    const fromRelIdx = fromIdx !== -1 ? fromIdx : 0;
                    x2 = relpCenterX[fromRelIdx] !== undefined ? relpCenterX[fromRelIdx] + 50 : 100;
                }

                const cx = (x1 + x2) / 2;
                const left = cx - textWidth / 2;
                const right = cx + textWidth / 2;
                
                // Track arrow ends themselves as well as label bounds
                const arrowMin = Math.min(x1, x2);
                const arrowMax = Math.max(x1, x2);

                const finalLeft = Math.min(left, arrowMin);
                const finalRight = Math.max(right, arrowMax);

                if (finalLeft < minX) minX = finalLeft;
                if (finalRight > maxX) maxX = finalRight;
            }
        });

        return { minX, maxX };
    }

    private calculateGroupLayouts(
        diagram: SequenceDiagram,
        participants: ParticipantLayout[],
        noteLayouts: NoteLayout[],
        stepY: number[],
        maxStep: number,
        participantYStart: number,
        totalHeight: number,
        bottomPadding: number
    ): GroupLayout[] {
        const maxGroupLevel = diagram.groups.length > 0 ? Math.max(...diagram.groups.map(g => g.level)) : 0;

        return diagram.groups.map(g => {
            const pIdxs = g.participants.map(name => participants.findIndex(pl => pl.participant.name === name)).filter(i => i !== -1);
            if (pIdxs.length === 0) return null;
            const minIdx = Math.min(...pIdxs);
            const maxIdx = Math.max(...pIdxs);

            const levelOffset = (maxGroupLevel - g.level);
            const hPadding = 10 + levelOffset * 10;
            const vPaddingTop = 25 + levelOffset * 8;
            const vPaddingBottom = 5 + levelOffset * 8;

            let rectX = participants[minIdx].x - hPadding;
            let rectW = (participants[maxIdx].x + participants[maxIdx].width + hPadding) - rectX;

            // Check expansion (copy logic)
            const notesInGroup = noteLayouts.filter(nl => {
                const n = nl.note;
                if (n.step < g.startStep || n.step > (g.endStep || maxStep)) return false;
                let owner = n.owner;
                if (!owner) return false;
                if (owner === g) return true;
                const ownerEnd = owner.endStep ?? maxStep;
                const groupEnd = g.endStep ?? maxStep;
                return owner.startStep >= g.startStep && ownerEnd <= groupEnd;
            });

            notesInGroup.forEach(nl => {
                // expansion logic using nl.x and nl.width
                const n = nl.note;
                if (n.position === 'right') {
                    // Check if rightmost
                    const nPIdxs = (n.participants || []).map(name => participants.findIndex(p => p.participant.name === name)).filter(i => i !== -1);
                    if (nPIdxs.length > 0 && Math.max(...nPIdxs) === maxIdx) {
                        const noteRight = nl.x + nl.width;
                        const groupRight = rectX + rectW;
                        if (noteRight + 10 > groupRight) {
                            rectW = (noteRight + 10) - rectX;
                        }
                    }
                } else if (n.position === 'left') {
                    const nPIdxs = (n.participants || []).map(name => participants.findIndex(p => p.participant.name === name)).filter(i => i !== -1);
                    if (nPIdxs.length > 0 && Math.min(...nPIdxs) === minIdx) {
                        const noteLeft = nl.x;
                        const groupLeft = rectX;
                        if (noteLeft - 10 < groupLeft) {
                            const diff = groupLeft - (noteLeft - 10);
                            rectX -= diff;
                            rectW += diff;
                        }
                    }
                }
            });

            let yStart: number;
            let height: number;

            if (g.type === 'box') {
                yStart = participantYStart - 15;
                if (g.label) {
                    yStart = participantYStart - 35;
                }
                const yEnd = totalHeight - bottomPadding - 10;
                height = yEnd - yStart;
            } else {
                yStart = stepY[g.startStep] - vPaddingTop;
                height = (stepY[g.endStep!] + vPaddingBottom) - yStart;
            }

            // Calculate section Y positions
            const sections = g.sections.map(s => ({
                label: s.label,
                y: stepY[s.startStep],
                color: s.color
            }));

            return {
                group: g,
                x: rectX,
                y: yStart,
                width: rectW,
                height,
                type: g.type,
                label: g.label,
                sections,
                color: g.color,
                headerColor: g.headerColor
            } as GroupLayout;

        }).filter(g => g !== null) as GroupLayout[];
    }
}
