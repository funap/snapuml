import { SequenceDiagram, Note, Participant, Message, Activation, Group, Reference, ArrowHead } from './SequenceDiagram';
import { SequenceTheme } from './SequenceTheme';

export const LAYOUT = {
    // Participant vertical adjustments
    BOX_LABEL_OFFSET_Y: 25,
    TITLE_MIN_Y: 55,
    HEADER_MIN_Y: 35,
    FOOTER_EXTRA_PADDING: 25,
    FOOTBOX_GAP: 20,
    PARTICIPANT_ICON_MIN_HEIGHT: 20,

    // Time constraints
    TIME_CONSTRAINT_BASE_SPACE: 50,
    TIME_CONSTRAINT_CHAR_WIDTH: 8,
    TIME_CONSTRAINT_OFFSET_X: 20,

    // References
    REFERENCE_OFFSET_Y: 10,
    REFERENCE_MIN_HEIGHT_PER_LINE: 15,
    REFERENCE_HEADER_HEIGHT: 40,

    // Activations
    ACTIVATION_LEVEL_OFFSET: 5,
    ACTIVATION_MIN_HEIGHT: 5,

    // Notes
    NOTE_MIN_WIDTH: 60,
    NOTE_HEIGHT_PER_LINE: 20,
    NOTE_PADDING_Y: 10,
    NOTE_CHAR_WIDTH: 8.5,
    NOTE_PADDING_X: 20,
    NOTE_COLLISION_GAP: 10,
    NOTE_POSITION_OFFSET_X: 5,
    NOTE_LEFT_MARGIN: 15,
    NOTE_RIGHT_MARGIN: 15,

    // Messages
    MESSAGE_CHAR_WIDTH: 8,
    MESSAGE_PADDING_X: 20,
    MESSAGE_SELF_LOOP_HEIGHT: 25,
    MESSAGE_SELF_LINE_HEIGHT: 20,
    MESSAGE_SELF_PADDING_Y: 10,
    MESSAGE_TEXT_LINE_HEIGHT: 15,
    MESSAGE_TEXT_PADDING_Y: 5,
    MESSAGE_SELF_DIFF_X: 40,
    MESSAGE_SELF_LOOP_Y_OFFSET: 25,
    MESSAGE_SELF_LABEL_OFFSET_X: 5,
    MESSAGE_SELF_LABEL_OFFSET_Y: 10,
    MESSAGE_COMPACT_GAP: 20,
    MESSAGE_LAST_STEP_GAP: 40,
    MESSAGE_PSEUDO_PARTICIPANT_GAP: 80,
    MESSAGE_DEFAULT_LEFTMOST_X: 50,
    MESSAGE_DEFAULT_RIGHTMOST_X: 150,
    MESSAGE_DEFAULT_UNKNOWN_X: 100,
    MESSAGE_UNKNOWN_OFFSET_X: 50,

    // Groups
    GROUP_LEVEL_OFFSET_X: 10,
    GROUP_LEVEL_OFFSET_Y: 8,
    GROUP_MIN_PADDING_X: 10,
    GROUP_MIN_PADDING_TOP: 25,
    GROUP_MIN_PADDING_BOTTOM: 5,
    GROUP_BOX_MARGIN_Y: 15,
    GROUP_BOX_LABEL_MARGIN_Y: 35,
    GROUP_BOX_END_MARGIN_Y: 10,
    GROUP_START_MARGIN_Y: 25,
    GROUP_END_MARGIN_Y: 20,
    GROUP_STEP_GAP_DIVIDER: 30,
    GROUP_STEP_GAP_DELAY: 40,

    // Gaps and Spacing
    GAP_BASE: 60,
    PARTICIPANT_CREATION_PADDING: 20,
    RIGHT_SPACE_BASE: 15,
    LEFT_SPACE_BASE: 15,

    // Participant size calculation
    PARTICIPANT_CHAR_WIDTH: 9,
    PARTICIPANT_PADDING_X: 30,
    STEREO_CHAR_WIDTH: 8,
    STEREO_PADDING_X: 30,
    STEREO_SPOT_EXTRA: 22,
    STEREO_EXTRA_HEIGHT: 18,
    PARTICIPANT_NON_BOX_BASE_HEIGHT: 55,
    PARTICIPANT_LINE_HEIGHT: 15,
    PARTICIPANT_BOX_BASE_HEIGHT: 30,
    PARTICIPANT_STEREO_BOX_BASE_HEIGHT: 60,

    // Header/margin gaps
    HEADER_GAP_MIN: 30,
    HEADER_GAP_PADDING: 10,
};

export function calculateNoteWidth(text: string): number {
    const lines = text.split('\n');
    const calculatedWidth = Math.max(...lines.map(l => l.length * LAYOUT.NOTE_CHAR_WIDTH)) + LAYOUT.NOTE_PADDING_X;
    return Math.max(calculatedWidth, LAYOUT.NOTE_MIN_WIDTH);
}

export function calculateNoteHeight(text: string): number {
    const lines = text.split('\n');
    return lines.length * LAYOUT.NOTE_HEIGHT_PER_LINE + LAYOUT.NOTE_PADDING_Y;
}

export function resolveMessageEndpoints(
    from: string,
    to: string,
    fromIdx: number,
    toIdx: number,
    centerXs: number[],
    leftmostCenterX: number | undefined,
    rightmostCenterX: number | undefined
): { x1: number; x2: number } {
    let x1 = 0;
    if (fromIdx !== -1) {
        x1 = centerXs[fromIdx];
    } else if (from === '[') {
        x1 = leftmostCenterX !== undefined ? leftmostCenterX - LAYOUT.MESSAGE_PSEUDO_PARTICIPANT_GAP : LAYOUT.MESSAGE_DEFAULT_LEFTMOST_X;
    } else if (from === ']') {
        x1 = rightmostCenterX !== undefined ? rightmostCenterX + LAYOUT.MESSAGE_PSEUDO_PARTICIPANT_GAP : LAYOUT.MESSAGE_DEFAULT_RIGHTMOST_X;
    } else if (from === '?') {
        const fallback = centerXs[0] ?? LAYOUT.MESSAGE_DEFAULT_UNKNOWN_X;
        const toX = toIdx !== -1 ? centerXs[toIdx] : fallback;
        x1 = toX - LAYOUT.MESSAGE_UNKNOWN_OFFSET_X;
    }

    let x2 = 0;
    if (toIdx !== -1) {
        x2 = centerXs[toIdx];
    } else if (to === ']') {
        x2 = rightmostCenterX !== undefined ? rightmostCenterX + LAYOUT.MESSAGE_PSEUDO_PARTICIPANT_GAP : LAYOUT.MESSAGE_DEFAULT_RIGHTMOST_X;
    } else if (to === '[') {
        x2 = leftmostCenterX !== undefined ? leftmostCenterX - LAYOUT.MESSAGE_PSEUDO_PARTICIPANT_GAP : LAYOUT.MESSAGE_DEFAULT_LEFTMOST_X;
    } else if (to === '?') {
        const fallback = centerXs[0] ?? LAYOUT.MESSAGE_DEFAULT_LEFTMOST_X;
        const fromX = fromIdx !== -1 ? centerXs[fromIdx] : fallback;
        x2 = fromX + LAYOUT.MESSAGE_UNKNOWN_OFFSET_X;
    }

    return { x1, x2 };
}

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
            participantYStart += LAYOUT.BOX_LABEL_OFFSET_Y;
        }
        if (diagram.title) {
            participantYStart = Math.max(participantYStart, LAYOUT.TITLE_MIN_Y + (hasBoxWithLabel ? LAYOUT.BOX_LABEL_OFFSET_Y : 0));
        } else if (diagram.header) {
            participantYStart = Math.max(participantYStart, LAYOUT.HEADER_MIN_Y + (hasBoxWithLabel ? LAYOUT.BOX_LABEL_OFFSET_Y : 0));
        }

        let bottomPadding = this.theme.padding;
        if (diagram.footer) {
            bottomPadding += LAYOUT.FOOTER_EXTRA_PADDING; // Space for footer
        }

        const pHeights = participants.map(p => this.calculateParticipantHeight(p));
        const maxPHeight = Math.max(this.theme.participantHeight, ...pHeights);

        const headerPHeights = participants
            .filter(p => p.createdStep === undefined)
            .map(p => this.calculateParticipantHeight(p));
        const maxHeaderPHeight = Math.max(this.theme.participantHeight, ...headerPHeights);

        const stepHeightResult = this.calculateStepHeights(diagram, maxStep, participantYStart, maxHeaderPHeight);
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
            const timeConstraintSpace = LAYOUT.TIME_CONSTRAINT_BASE_SPACE + (maxLabelLength * LAYOUT.TIME_CONSTRAINT_CHAR_WIDTH); // arrow + label width
            totalWidth += timeConstraintSpace;
        }

        const footboxHeight = diagram.hideFootbox ? 0 : maxPHeight + LAYOUT.FOOTBOX_GAP;
        const totalHeight = currentY + footboxHeight + bottomPadding;

        // Finalize X positions
        const participantLayouts: ParticipantLayout[] = participants.map((p, i) => {
            const centerX = relpCenterX[i] + offsetX;
            const pH = pHeights[i];
            const pIconYOffset = p.type === 'participant' ? pH / 2 : LAYOUT.PARTICIPANT_ICON_MIN_HEIGHT;
            return {
                participant: p,
                centerX: centerX,
                x: centerX - pWidths[i] / 2,
                y: p.createdStep !== undefined ? stepY[p.createdStep] - pIconYOffset : participantYStart,
                width: pWidths[i],
                height: pH,
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
        const centerXs = participants.map(p => p.centerX);

        return diagram.messages.map(m => {
            const fromIdx = participants.findIndex(p => p.participant.name === m.from);
            const toIdx = participants.findIndex(p => p.participant.name === m.to);
            const y = stepY[m.step];

            // Default center positions
            let { x1, x2 } = resolveMessageEndpoints(
                m.from,
                m.to,
                fromIdx,
                toIdx,
                centerXs,
                centerXs[0],
                centerXs[centerXs.length - 1]
            );

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

                    const diff = LAYOUT.MESSAGE_SELF_DIFF_X;
                    points[0] = { x: baseXStart, y };
                    points[1] = { x: Math.max(baseXStart, baseXEnd) + diff, y };
                    points.push({ x: Math.max(baseXStart, baseXEnd) + diff, y: y + LAYOUT.MESSAGE_SELF_LOOP_Y_OFFSET + delay });
                    points.push({ x: baseXEnd, y: y + LAYOUT.MESSAGE_SELF_LOOP_Y_OFFSET + delay });
                    labelPosition = { x: Math.max(baseXStart, baseXEnd) + diff + LAYOUT.MESSAGE_SELF_LABEL_OFFSET_X, y: y + LAYOUT.MESSAGE_SELF_LABEL_OFFSET_Y + delay / 2 };
                } else {
                    // No activation, use participant center
                    const baseX = participants[fromIdx].centerX;
                    const diff = LAYOUT.MESSAGE_SELF_DIFF_X;
                    points[0] = { x: baseX, y };
                    points[1] = { x: baseX + diff, y };
                    points.push({ x: baseX + diff, y: y + LAYOUT.MESSAGE_SELF_LOOP_Y_OFFSET + delay });
                    points.push({ x: baseX, y: y + LAYOUT.MESSAGE_SELF_LOOP_Y_OFFSET + delay });
                    labelPosition = { x: baseX + diff + LAYOUT.MESSAGE_SELF_LABEL_OFFSET_X, y: y + LAYOUT.MESSAGE_SELF_LABEL_OFFSET_Y + delay / 2 };
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
                x: totalWidth - this.theme.padding + LAYOUT.TIME_CONSTRAINT_OFFSET_X, // Position to the right of the diagram
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
            const y = stepY[r.startStep] - LAYOUT.REFERENCE_OFFSET_Y;
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
            const x = p.centerX - (this.theme.activationWidth / 2) + (a.level * LAYOUT.ACTIVATION_LEVEL_OFFSET);
            let y = stepY[a.startStep];

            if (a.sourceStep !== undefined) {
                const triggerMsg = messages.find(m => m.step === a.sourceStep);
                if (triggerMsg) {
                    const delay = triggerMsg.arrowDelay || 0;
                    if (triggerMsg.from === a.participantName && triggerMsg.to === a.participantName) {
                        y += LAYOUT.MESSAGE_SELF_LOOP_Y_OFFSET + delay;
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
                        yEnd += LAYOUT.MESSAGE_SELF_LOOP_Y_OFFSET + delay;
                    } else {
                        const isReverse = isHead(closeMsg.startHead) && !isHead(closeMsg.arrowHead);
                        const endsAtParticipant = (!isReverse && closeMsg.to === a.participantName) || (isReverse && closeMsg.from === a.participantName);
                        if (endsAtParticipant) {
                            yEnd += delay;
                        }
                    }
                }
            }

            const minHeight = LAYOUT.ACTIVATION_MIN_HEIGHT; // Minimum height to ensure activation is visible
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

    private calculateStepHeights(diagram: SequenceDiagram, maxStep: number, participantYStart: number, maxHeaderPHeight: number) {
        const stepHeights = new Array(maxStep + 1).fill(this.theme.defaultMessageGap);
        const topExtension = new Array(maxStep + 2).fill(0);
        const bottomExtension = new Array(maxStep + 2).fill(0);

        diagram.participants.forEach(p => {
            if (p.name === '[' || p.name === ']' || p.name === '?') return;
            if (p.createdStep !== undefined) {
                const pH = this.calculateParticipantHeight(p);
                const pIconYOffset = p.type === 'participant' ? pH / 2 : 20;
                topExtension[p.createdStep] = Math.max(topExtension[p.createdStep], pIconYOffset);
                bottomExtension[p.createdStep] = Math.max(bottomExtension[p.createdStep], pH - pIconYOffset);
            }
        });

        diagram.notes.forEach(n => {
            const noteHeight = calculateNoteHeight(n.text);
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
                const loopHeight = Math.max(LAYOUT.MESSAGE_SELF_LOOP_HEIGHT, textLines * LAYOUT.MESSAGE_SELF_LINE_HEIGHT);
                topExtension[m.step] = Math.max(topExtension[m.step], 0);
                bottomExtension[m.step] = Math.max(bottomExtension[m.step], loopHeight + LAYOUT.MESSAGE_SELF_PADDING_Y + delay);
            } else {
                const textHeight = hasText ? textLines * LAYOUT.MESSAGE_TEXT_LINE_HEIGHT + LAYOUT.MESSAGE_TEXT_PADDING_Y : 0;
                topExtension[m.step] = Math.max(topExtension[m.step], textHeight);
                bottomExtension[m.step] = Math.max(bottomExtension[m.step], delay);
            }
        });

        // Group top and bottom extensions
        const maxGroupLevel = diagram.groups.length > 0 ? Math.max(...diagram.groups.map(g => g.level)) : 0;
        diagram.groups.forEach(g => {
            if (g.type === 'box') return;
            const levelOffset = (maxGroupLevel - g.level);
            const vPaddingTop = LAYOUT.GROUP_MIN_PADDING_TOP + levelOffset * LAYOUT.GROUP_LEVEL_OFFSET_Y;
            const vPaddingBottom = LAYOUT.GROUP_MIN_PADDING_BOTTOM + levelOffset * LAYOUT.GROUP_LEVEL_OFFSET_Y;

            topExtension[g.startStep] = Math.max(topExtension[g.startStep], vPaddingTop);
            if (g.endStep !== undefined) {
                bottomExtension[g.endStep] = Math.max(bottomExtension[g.endStep], vPaddingBottom);
            }
        });

        const baseHeights = new Array(maxStep + 1).fill(this.theme.defaultMessageGap);
        if (maxStep > 0) {
            baseHeights[maxStep - 1] = LAYOUT.MESSAGE_LAST_STEP_GAP; // Compact spacing for the last step before the footbox
        }

        // Apply compact spacing (baseHeight = 20) for all steps containing messages (with or without labels)
        for (let i = 0; i <= maxStep; i++) {
            const stepMessages = diagram.messages.filter(m => m.step === i);
            if (stepMessages.length > 0) {
                baseHeights[i] = LAYOUT.MESSAGE_COMPACT_GAP;
            }
        }
        diagram.dividers.forEach(d => { baseHeights[d.step] = LAYOUT.GROUP_STEP_GAP_DIVIDER; });
        diagram.delays.forEach(d => { baseHeights[d.step] = LAYOUT.GROUP_STEP_GAP_DELAY; });
        diagram.spacings.forEach(s => { baseHeights[s.step] = s.height; });
        diagram.references.forEach(r => {
            const lines = r.label.split('\n');
            const textHeight = lines.length * LAYOUT.REFERENCE_MIN_HEIGHT_PER_LINE + LAYOUT.REFERENCE_HEADER_HEIGHT; // Approx height for ref with header
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
            let margin = LAYOUT.NOTE_PADDING_Y;
            if (isGroupStartStep(i + 1)) {
                margin = Math.max(margin, LAYOUT.GROUP_START_MARGIN_Y);
            }
            if (isGroupEndStep(i)) {
                margin = Math.max(margin, LAYOUT.GROUP_END_MARGIN_Y);
            }
            const requiredGap = bottomExtension[i] + topExtension[i + 1] + margin;
            stepHeights[i] = Math.max(baseHeights[i], requiredGap);
        }

        const stepY = new Array(maxStep + 1).fill(0);
        const headerGap = Math.max(LAYOUT.HEADER_GAP_MIN, topExtension[0] + LAYOUT.HEADER_GAP_PADDING);
        let currentY = participantYStart + maxHeaderPHeight + headerGap;
        for (let i = 0; i <= maxStep; i++) {
            stepY[i] = currentY;
            currentY += stepHeights[i];
        }

        return { stepY, totalHeight: stepY[maxStep] };
    }

    private calculateParticipantWidth(p: Participant): number {
        const label = (p.label || p.name).replace(/\\n/g, '\n');
        const lines = label.split('\n').map(l => l.trim());
        let maxLineLength = Math.max(...lines.map(l => l.length));
        
        let minWidth = this.theme.participantWidth;
        let textWidth = maxLineLength * LAYOUT.PARTICIPANT_CHAR_WIDTH + LAYOUT.PARTICIPANT_PADDING_X;

        if (p.stereotype) {
            const parsed = parseStereotype(p.stereotype);
            if (parsed) {
                let stereoText = '';
                if (parsed.text) {
                    stereoText = `«${parsed.text}»`;
                }
                let stereoWidth = stereoText.length * LAYOUT.STEREO_CHAR_WIDTH + LAYOUT.STEREO_PADDING_X;
                if (parsed.spotChar) {
                    stereoWidth += LAYOUT.STEREO_SPOT_EXTRA;
                }
                textWidth = Math.max(textWidth, stereoWidth);
            }
        }

        return Math.max(minWidth, textWidth);
    }

    private calculateParticipantHeight(p: Participant): number {
        const label = (p.label || p.name).replace(/\\n/g, '\n');
        const lines = label.split('\n').map(l => l.trim());
        const numLines = lines.length;

        let baseHeight = this.theme.participantHeight;
        if (p.type !== 'participant') {
            let extra = 0;
            if (p.stereotype) {
                extra = LAYOUT.STEREO_EXTRA_HEIGHT;
            }
            baseHeight = LAYOUT.PARTICIPANT_NON_BOX_BASE_HEIGHT + extra + numLines * LAYOUT.PARTICIPANT_LINE_HEIGHT;
        } else {
            if (numLines > 1) {
                baseHeight = Math.max(baseHeight, LAYOUT.PARTICIPANT_BOX_BASE_HEIGHT + numLines * LAYOUT.PARTICIPANT_LINE_HEIGHT);
            }
            if (p.stereotype) {
                baseHeight = Math.max(baseHeight, LAYOUT.PARTICIPANT_STEREO_BOX_BASE_HEIGHT + (numLines - 1) * LAYOUT.PARTICIPANT_LINE_HEIGHT);
            }
        }
        return baseHeight;
    }

    // Simplified gap calculation for brevity in this first pass
    private calculateGaps(diagram: SequenceDiagram, participants: Participant[], pWidths: number[]): number[] {
        const numGaps = Math.max(0, participants.length - 1);
        const gaps = new Array(numGaps).fill(LAYOUT.GAP_BASE);
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
                        gapRequirements[i] = Math.max(gapRequirements[i], boxWidth / 2 + LAYOUT.PARTICIPANT_CREATION_PADDING);
                    }
                }

                // Right side of P_i
                let rightSpace = LAYOUT.RIGHT_SPACE_BASE;
                const selfMsg = diagram.messages.find(m => m.step === s && m.from === name && m.to === name);
                if (selfMsg) {
                    const textWidth = Math.max(...selfMsg.text.split('\n').map(l => l.length * LAYOUT.MESSAGE_CHAR_WIDTH)) + LAYOUT.MESSAGE_PADDING_X;
                    rightSpace = LAYOUT.MESSAGE_SELF_DIFF_X + textWidth + LAYOUT.NOTE_COLLISION_GAP;
                }
                const activeAlt = diagram.activations.filter(a => a.participantName === name && a.startStep <= s && (a.endStep ?? Infinity) >= s);
                if (activeAlt.length > 0) {
                    const maxL = Math.max(...activeAlt.map(a => a.level));
                    rightSpace = Math.max(rightSpace, (this.theme.activationWidth / 2) + (maxL * LAYOUT.ACTIVATION_LEVEL_OFFSET) + LAYOUT.NOTE_COLLISION_GAP);
                }
                const notesR = diagram.notes.filter(n => n.step === s && n.position === 'right' && n.participants?.includes(name));
                notesR.forEach(n => {
                    const w = calculateNoteWidth(n.text);
                    rightSpace += w + LAYOUT.NOTE_COLLISION_GAP;
                });

                if (i < numGaps) gapRequirements[i] += rightSpace;

                // Left side of P_i
                let leftSpace = LAYOUT.LEFT_SPACE_BASE;
                const notesL = diagram.notes.filter(n => n.step === s && n.position === 'left' && n.participants?.includes(name));
                notesL.forEach(n => {
                    const w = calculateNoteWidth(n.text);
                    leftSpace += w + LAYOUT.NOTE_COLLISION_GAP;
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

            const textWidth = Math.max(...m.text.split('\n').map(l => l.length * LAYOUT.MESSAGE_CHAR_WIDTH)) + LAYOUT.MESSAGE_PADDING_X;
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
            const noteWidth = calculateNoteWidth(n.text);

            if (n.participants && n.participants.length > 0) {
                const sIdx = participants.findIndex(p => p.name === n.participants![0]);
                const eIdx = n.participants.length > 1 ? participants.findIndex(p => p.name === n.participants![1]) : sIdx;
                if (sIdx === -1 || eIdx === -1) return;

                const s = Math.min(sIdx, eIdx);
                const e = Math.max(sIdx, eIdx);
                if (s === e) {
                    const required = noteWidth / 2 + LAYOUT.NOTE_COLLISION_GAP;
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
            const noteWidth = calculateNoteWidth(note.text);
            const noteHeight = calculateNoteHeight(note.text);
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
                        const currentRightEdge = stepOccupancy.get(key) ?? (cx - effectiveBoxOffset - LAYOUT.NOTE_POSITION_OFFSET_X);
                        x = currentRightEdge - noteWidth;
                        stepOccupancy.set(key, x - LAYOUT.NOTE_COLLISION_GAP);
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
                            const textWidth = Math.max(...textLines.map(l => l.length * LAYOUT.MESSAGE_CHAR_WIDTH)) + LAYOUT.MESSAGE_PADDING_X;
                            selfMsgRightOffset = LAYOUT.MESSAGE_SELF_DIFF_X + textWidth;
                        }

                        // Also account for activations
                        const activeAlt = diagram.activations.filter(a =>
                            a.participantName === participant.name &&
                            a.startStep <= note.step &&
                            (a.endStep ?? Infinity) >= note.step
                        );
                        const maxLevel = activeAlt.length > 0 ? Math.max(...activeAlt.map(a => a.level)) : 0;
                        const activationOffset = (this.theme.activationWidth / 2) + (maxLevel * LAYOUT.ACTIVATION_LEVEL_OFFSET);

                        const baseRight = Math.max(effectiveBoxOffset, activationOffset, selfMsgRightOffset);

                        const currentLeftEdge = stepOccupancy.get(key) ?? (cx + baseRight + LAYOUT.NOTE_POSITION_OFFSET_X);
                        x = currentLeftEdge;
                        stepOccupancy.set(key, x + noteWidth + LAYOUT.NOTE_COLLISION_GAP);
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
            const hPadding = LAYOUT.GROUP_MIN_PADDING_X + levelOffset * LAYOUT.GROUP_LEVEL_OFFSET_X;

            const groupLeft = (relpCenterX[minIdx] - pWidths[minIdx] / 2) - hPadding;
            const groupRight = (relpCenterX[maxIdx] + pWidths[maxIdx] / 2) + hPadding;

            if (groupLeft < minX) minX = groupLeft;
            if (groupRight > maxX) maxX = groupRight;
        });

        messages.forEach(m => {
            const fromIdx = participants.findIndex(p => p.name === m.from);
            const toIdx = participants.findIndex(p => p.name === m.to);
            
            const textLines = m.text.split('\n');
            const textWidth = Math.max(...textLines.map(l => l.length * LAYOUT.MESSAGE_CHAR_WIDTH)) + LAYOUT.MESSAGE_PADDING_X; // simplified calc

            if (fromIdx !== -1 && fromIdx === toIdx) {
                const cx = relpCenterX[fromIdx];
                const rightBound = cx + LAYOUT.MESSAGE_SELF_DIFF_X + textWidth + LAYOUT.NOTE_COLLISION_GAP;
                if (rightBound > maxX) maxX = rightBound;
            } else {
                let { x1, x2 } = resolveMessageEndpoints(
                    m.from,
                    m.to,
                    fromIdx,
                    toIdx,
                    relpCenterX,
                    relpCenterX[0],
                    relpCenterX[relpCenterX.length - 1]
                );

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
            const hPadding = LAYOUT.GROUP_MIN_PADDING_X + levelOffset * LAYOUT.GROUP_LEVEL_OFFSET_X;
            const vPaddingTop = LAYOUT.GROUP_MIN_PADDING_TOP + levelOffset * LAYOUT.GROUP_LEVEL_OFFSET_Y;
            const vPaddingBottom = LAYOUT.GROUP_MIN_PADDING_BOTTOM + levelOffset * LAYOUT.GROUP_LEVEL_OFFSET_Y;

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
                        if (noteRight + LAYOUT.GROUP_MIN_PADDING_X > groupRight) {
                            rectW = (noteRight + LAYOUT.GROUP_MIN_PADDING_X) - rectX;
                        }
                    }
                } else if (n.position === 'left') {
                    const nPIdxs = (n.participants || []).map(name => participants.findIndex(p => p.participant.name === name)).filter(i => i !== -1);
                    if (nPIdxs.length > 0 && Math.min(...nPIdxs) === minIdx) {
                        const noteLeft = nl.x;
                        const groupLeft = rectX;
                        if (noteLeft - LAYOUT.GROUP_MIN_PADDING_X < groupLeft) {
                            const diff = groupLeft - (noteLeft - LAYOUT.GROUP_MIN_PADDING_X);
                            rectX -= diff;
                            rectW += diff;
                        }
                    }
                }
            });

            let yStart: number;
            let height: number;

            if (g.type === 'box') {
                yStart = participantYStart - LAYOUT.GROUP_BOX_MARGIN_Y;
                if (g.label) {
                    yStart = participantYStart - LAYOUT.GROUP_BOX_LABEL_MARGIN_Y;
                }
                const yEnd = totalHeight - bottomPadding - LAYOUT.GROUP_BOX_END_MARGIN_Y;
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
