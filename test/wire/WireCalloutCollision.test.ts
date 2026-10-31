import { describe, it, expect } from 'vitest';
import { WireParser } from '../../src/diagrams/wire/WireParser';
import { WireLayout } from '../../src/diagrams/wire/WireLayout';
import { WireRenderer } from '../../src/diagrams/wire/WireRenderer';
import { getTextWidth } from '../../src/core/RichText';

describe('Wire Callout Collision Avoidance', () => {
    const code = `# Raspberry Pi 4 スマート家電制御回路
board RPI4_HUB "Raspberry Pi 4 IoT Hub" {
  SOC "BCM2711 (RPi 4)" {
    width: 220px
    height: 160px
    color: #DCFCE7
    note: "Quad Cortex-A72 / 3.3V GPIO"
  }

  TYPE_C "USB Type-C (5V 3A)" @ edge.top
  TYPE_C -> SOC.top : power(5.1V / 3A)

  # 左面: PIR 人感センサー (モーション検知)
  PIR_SENSOR "HC-SR501 PIR" .right -> SOC.left : gpio(GPIO 17, 3.3V Out)

  # 右面: フォトカプラ絶縁 4ch リレー
  SOC.right -> RELAY_MOD "4ch Optocoupled Relay" .left : gpio(Active-Low: GPIO 22-25)

  warning for RELAY_MOD.right "AC 100V 強電部アイソレーション (危険)"
}

AC_LAMP "AC 100V Desk Lamp"
RPI4_HUB.RELAY_MOD.right ---> AC_LAMP.left : power(100V 2A Relay NO/COM) via connector("Terminal Block")`;

    it('should not overlap callout with any component in rpi4SmartHome', () => {
        const parser = new WireParser();
        const diagram = parser.parse(code);
        const layout = new WireLayout();
        const result = layout.layout(diagram);

        expect(result.callouts.length).toBe(1);
        const callout = result.callouts[0];

        // 1. Callout must not collide with any component
        for (const comp of result.components) {
            const overlapX = Math.max(0, Math.min(callout.x + callout.width, comp.x + comp.width) - Math.max(callout.x, comp.x));
            const overlapY = Math.max(0, Math.min(callout.y + callout.height, comp.y + comp.height) - Math.max(callout.y, comp.y));
            expect(overlapX * overlapY).toBe(0);
        }

        // 2. Callout must not collide with wire between RELAY_MOD and AC_LAMP
        const relayWire = result.wires.find(w => w.sourceId === 'RELAY_MOD' && w.targetId === 'AC_LAMP');
        expect(relayWire).toBeDefined();
        for (let i = 0; i < relayWire!.points.length - 1; i++) {
            const p1 = relayWire!.points[i];
            const p2 = relayWire!.points[i + 1];
            const isHoriz = Math.abs(p1.y - p2.y) < 2;
            if (isHoriz) {
                // If callout overlaps the horizontal wire in Y range
                const inYRange = callout.y <= p1.y && (callout.y + callout.height) >= p1.y;
                const inXRange = Math.max(callout.x, Math.min(p1.x, p2.x)) <= Math.min(callout.x + callout.width, Math.max(p1.x, p2.x));
                expect(inYRange && inXRange).toBe(false);
            }
        }

        // 3. Callout must not collide with boundary connector badge
        expect(relayWire!.boundaryConnectors.length).toBeGreaterThan(0);
        const bc = relayWire!.boundaryConnectors[0];
        const badgeW = Math.max(24, Math.ceil(getTextWidth(bc.label || 'CN', 10)) + 14);
        const badgeX = bc.face === 'right' ? bc.x + 8 : bc.x - badgeW - 8;
        const badgeY = bc.y - 10;
        const bcOverlapX = Math.max(0, Math.min(callout.x + callout.width, badgeX + badgeW) - Math.max(callout.x, badgeX));
        const bcOverlapY = Math.max(0, Math.min(callout.y + callout.height, badgeY + 18) - Math.max(callout.y, badgeY));
        expect(bcOverlapX * bcOverlapY).toBe(0);

        // 4. Boundary connector badge must not overlap AC_LAMP
        const acLamp = result.components.find(c => c.id === 'AC_LAMP')!;
        const lampBcOverlapX = Math.max(0, Math.min(acLamp.x + acLamp.width, badgeX + badgeW) - Math.max(acLamp.x, badgeX));
        const lampBcOverlapY = Math.max(0, Math.min(acLamp.y + acLamp.height, badgeY + 18) - Math.max(acLamp.y, badgeY));
        expect(lampBcOverlapX * lampBcOverlapY).toBe(0);

        // 5. Wire label must not overlap AC_LAMP
        const rawLabel = relayWire!.protocol!.raw;
        const lblW = Math.max(20, Math.ceil(getTextWidth(rawLabel, 10)) + 14);
        const lastPt = relayWire!.points[relayWire!.points.length - 1];
        const midX = Math.max(bc.x + badgeW + lblW / 2 + 15, bc.x + (lastPt.x - bc.x) * 0.55);
        const lblOverlapX = Math.max(0, Math.min(acLamp.x + acLamp.width, midX + lblW / 2) - Math.max(acLamp.x, midX - lblW / 2));
        expect(lblOverlapX).toBe(0);

        // 6. Callout should stay cleanly inside RPI4_HUB board if target is inside
        const board = result.boards.find(b => b.id === 'RPI4_HUB')!;
        expect(callout.x).toBeGreaterThanOrEqual(board.x);
        expect(callout.x + callout.width).toBeLessThanOrEqual(board.x + board.width);
        expect(callout.y).toBeGreaterThanOrEqual(board.y + 40); // below header
        expect(callout.y + callout.height).toBeLessThanOrEqual(board.y + board.height);
    });

    it('should place multiple callouts without colliding with each other or components', () => {
        const dsl = `
board MAIN {
  MCU "Main MCU" {
    width: 200px
    height: 150px
  }
  warning for MCU.right "High Voltage Pin"
  warning for MCU.right "Short Circuit Risk"
  note for MCU.left "Analog Input 3.3V"
}`;
        const parser = new WireParser();
        const diagram = parser.parse(dsl);
        const layout = new WireLayout();
        const result = layout.layout(diagram);

        expect(result.callouts.length).toBe(3);
        for (let i = 0; i < result.callouts.length; i++) {
            for (let j = i + 1; j < result.callouts.length; j++) {
                const c1 = result.callouts[i];
                const c2 = result.callouts[j];
                const overlapX = Math.max(0, Math.min(c1.x + c1.width, c2.x + c2.width) - Math.max(c1.x, c2.x));
                const overlapY = Math.max(0, Math.min(c1.y + c1.height, c2.y + c2.height) - Math.max(c1.y, c2.y));
                expect(overlapX * overlapY).toBe(0);
            }
        }
    });

    it('should support \\n in rpi4SmartHome warning without colliding with any object', () => {
        const multilineDsl = code.replace(
            'warning for RELAY_MOD.right "AC 100V 強電部アイソレーション (危険)"',
            'warning for RELAY_MOD.right "AC 100V 強電部\\nアイソレーション (危険)"'
        );
        const parser = new WireParser();
        const diagram = parser.parse(multilineDsl);
        const layout = new WireLayout();
        const result = layout.layout(diagram);

        expect(result.callouts.length).toBe(1);
        const callout = result.callouts[0];

        // Should be multiline height (> 30px)
        expect(callout.height).toBeGreaterThan(30);

        // Callout must not collide with any component
        for (const comp of result.components) {
            const overlapX = Math.max(0, Math.min(callout.x + callout.width, comp.x + comp.width) - Math.max(callout.x, comp.x));
            const overlapY = Math.max(0, Math.min(callout.y + callout.height, comp.y + comp.height) - Math.max(callout.y, comp.y));
            expect(overlapX * overlapY).toBe(0);
        }

        // Leader line should be cleanly connected to RELAY_MOD.right
        expect(callout.targetPoint.x).toBe(result.components.find(c => c.id === 'RELAY_MOD')!.x + result.components.find(c => c.id === 'RELAY_MOD')!.width);
    });
});
