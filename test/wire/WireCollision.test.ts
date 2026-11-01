import { describe, it, expect } from 'vitest';
import { WireParser } from '../../src/diagrams/wire/WireParser';
import { WireLayout } from '../../src/diagrams/wire/WireLayout';
import { renderWireDiagram } from '../../src/index';

describe('WireLayout Component Collision Prevention & De-overlap', () => {
    const nanoRobotCode = `# Arduino Nano 2WD Robot Car Circuit
board NANO_ROBOT "Nano Robot Controller" {
  MCU "Arduino Nano" {
    width: 200px
    height: 160px
    color: #E0F2FE
  }

  BATTERY "2S Li-ion Battery (7.4V)" @ edge.top
  BATTERY -> MCU.top : power(7.4V to VIN)

  # Left: HC-SR04 ultrasonic distance sensor
  ULTRASONIC "HC-SR04 Ultrasonic" .right -> MCU.left : gpio(Trig: D8, Echo: D9)

  # Right: L298N H-Bridge motor driver
  MCU.right -> DRIVER_L298N "L298N Motor Driver" .left : pwm(ENA, ENB / IN1-4)
}

# External motor connections
MOTOR_L "Left DC Motor"
MOTOR_R "Right DC Motor"
NANO_ROBOT.DRIVER_L298N.bottom -> MOTOR_L : power(OUT1, OUT2)
NANO_ROBOT.DRIVER_L298N.bottom -> MOTOR_R : power(OUT3, OUT4)
`;

    it('should place MOTOR_L and MOTOR_R without overlap in nanoRobotCar', () => {
        const parser = new WireParser();
        const diagram = parser.parse(nanoRobotCode);
        const layout = new WireLayout();
        const result = layout.layout(diagram);

        const motorL = result.components.find(c => c.id === 'MOTOR_L');
        const motorR = result.components.find(c => c.id === 'MOTOR_R');
        const driver = result.components.find(c => c.id === 'DRIVER_L298N');

        expect(motorL).toBeDefined();
        expect(motorR).toBeDefined();
        expect(driver).toBeDefined();

        if (motorL && motorR && driver) {
            // Check that MOTOR_L and MOTOR_R do NOT overlap
            const overlapX = Math.max(0, Math.min(motorL.x + motorL.width, motorR.x + motorR.width) - Math.max(motorL.x, motorR.x));
            const overlapY = Math.max(0, Math.min(motorL.y + motorL.height, motorR.y + motorR.height) - Math.max(motorL.y, motorR.y));
            expect(overlapX * overlapY).toBe(0);

            // MOTOR_L should be positioned to the left of MOTOR_R
            expect(motorL.x + motorL.width).toBeLessThanOrEqual(motorR.x);

            // DRIVER_L298N width expands according to the number of bottom arrows to make vertical wires straight
            expect(driver.width).toBe(360);

            // Both motors should be located below the board & driver
            expect(motorL.y).toBeGreaterThanOrEqual(driver.y + driver.height);
            expect(motorR.y).toBeGreaterThanOrEqual(driver.y + driver.height);

            // Both motor wires should be 2-point straight vertical lines
            const wireL = result.wires.find(w => w.targetId === 'MOTOR_L')!;
            const wireR = result.wires.find(w => w.targetId === 'MOTOR_R')!;

            expect(wireL).toBeDefined();
            expect(wireR).toBeDefined();
            expect(wireL.points.length).toBe(2);
            expect(wireL.points[0].x).toBe(wireL.points[1].x);
            expect(wireR.points.length).toBe(2);
            expect(wireR.points[0].x).toBe(wireR.points[1].x);
        }
    });

    it('should ensure no components in nanoRobotCar collide with each other', () => {
        const parser = new WireParser();
        const diagram = parser.parse(nanoRobotCode);
        const layout = new WireLayout();
        const result = layout.layout(diagram);

        const comps = result.components;
        for (let i = 0; i < comps.length; i++) {
            for (let j = i + 1; j < comps.length; j++) {
                const c1 = comps[i];
                const c2 = comps[j];
                const overlapX = Math.max(0, Math.min(c1.x + c1.width, c2.x + c2.width) - Math.max(c1.x, c2.x));
                const overlapY = Math.max(0, Math.min(c1.y + c1.height, c2.y + c2.height) - Math.max(c1.y, c2.y));
                expect(overlapX * overlapY, `Collision between ${c1.id} and ${c2.id}`).toBe(0);
            }
        }
    });

    it('should render SVG containing both motors with distinct x coordinates', () => {
        const svg = renderWireDiagram(nanoRobotCode);
        expect(svg).toContain('Left DC Motor');
        expect(svg).toContain('Right DC Motor');

        // Verify distinct SVG rect positions
        const parser = new WireParser();
        const diagram = parser.parse(nanoRobotCode);
        const layout = new WireLayout();
        const result = layout.layout(diagram);

        const motorL = result.components.find(c => c.id === 'MOTOR_L')!;
        const motorR = result.components.find(c => c.id === 'MOTOR_R')!;

        expect(motorL.x).not.toBe(motorR.x);
    });

    it('should resolve collisions between multiple components placed on the same face', () => {
        const code = `
board MAIN {
  MCU "Main MCU" {
    width: 150px
    height: 100px
  }
  MCU.right -> DEV1 "Device 1" .left
  MCU.right -> DEV2 "Device 2" .left
  MCU.right -> DEV3 "Device 3" .left
}
`;
        const parser = new WireParser();
        const diagram = parser.parse(code);
        const layout = new WireLayout();
        const result = layout.layout(diagram);

        const comps = result.components.filter(c => c.id.startsWith('DEV'));
        expect(comps.length).toBe(3);

        for (let i = 0; i < comps.length; i++) {
            for (let j = i + 1; j < comps.length; j++) {
                const c1 = comps[i];
                const c2 = comps[j];
                const overlapX = Math.max(0, Math.min(c1.x + c1.width, c2.x + c2.width) - Math.max(c1.x, c2.x));
                const overlapY = Math.max(0, Math.min(c1.y + c1.height, c2.y + c2.height) - Math.max(c1.y, c2.y));
                expect(overlapX * overlapY, `Collision between ${c1.id} and ${c2.id}`).toBe(0);
            }
        }
    });
});
