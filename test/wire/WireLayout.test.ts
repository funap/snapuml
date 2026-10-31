import { describe, it, expect } from 'vitest';
import { WireParser } from '../../src/diagrams/wire/WireParser';
import { WireLayout } from '../../src/diagrams/wire/WireLayout';

describe('WireLayout', () => {
    const parser = new WireParser();
    const layout = new WireLayout();

    it('should place primary anchor at origin and place adjacent nodes correctly', () => {
        const dsl = `
            MCU.right -> FLASH
            MCU.bottom -> SENSOR
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const mcu = result.components.find(c => c.id === 'MCU');
        const flash = result.components.find(c => c.id === 'FLASH');
        const sensor = result.components.find(c => c.id === 'SENSOR');

        expect(mcu).toBeDefined();
        expect(flash).toBeDefined();
        expect(sensor).toBeDefined();

        // MCU is primary anchor (2 connections)
        expect(mcu?.gridCol).toBe(0);
        expect(mcu?.gridRow).toBe(0);

        // FLASH is to the right
        expect(flash?.gridCol).toBe(1);
        expect(flash?.gridRow).toBe(0);
        expect(flash!.x).toBeGreaterThan(mcu!.x);

        // SENSOR is at the bottom
        expect(sensor?.gridCol).toBe(0);
        expect(sensor?.gridRow).toBe(1);
        expect(sensor!.y).toBeGreaterThan(mcu!.y);
    });

    it('should respect arrow distance (hyphen length) for offset', () => {
        const dsl = `
            MCU.right -> A
            MCU.right --> B
            MCU.right ---> C
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const a = result.components.find(c => c.id === 'A');
        const b = result.components.find(c => c.id === 'B');
        const c = result.components.find(c => c.id === 'C');

        expect(a?.gridCol).toBe(1); // distance 1 -> col + 1
        expect(b?.gridCol).toBe(2); // distance 2 -> col + 2
        expect(c?.gridCol).toBe(3); // distance 3 -> col + 3
    });

    it('should perform dynamic aspect ratio tracking for multiple connections on a face', () => {
        const dsl = `
            MCU.right -> A
            MCU.right -> B
            MCU.right -> C
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const mcu = result.components.find(c => c.id === 'MCU');
        expect(mcu).toBeDefined();
        // 3 connections on right face -> required height >= 3 * SlotPitch (80px) = 240px
        expect(mcu!.height).toBeGreaterThanOrEqual(240);
    });

    it('should support chained anchors and tier model', () => {
        const dsl = `
            MCU.right -> SENSOR1.left
            SENSOR1.right -> SENSOR2.left
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const mcu = result.components.find(c => c.id === 'MCU');
        const s1 = result.components.find(c => c.id === 'SENSOR1');
        const s2 = result.components.find(c => c.id === 'SENSOR2');

        expect(mcu?.gridCol).toBe(0);
        expect(s1?.gridCol).toBe(1);
        expect(s2?.gridCol).toBe(2);
        expect(s2!.x).toBeGreaterThan(s1!.x);
    });

    it('should separate core and edge components, placing edge components on perimeter line', () => {
        const dsl = `
            board MAIN {
                MCU.right -> FLASH.left
                MCU.right -> SD_SLOT @ edge.right
            }
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const mcu = result.components.find(c => c.id === 'MCU');
        const flash = result.components.find(c => c.id === 'FLASH');
        const sd = result.components.find(c => c.id === 'SD_SLOT');
        const board = result.boards.find(b => b.id === 'MAIN');

        expect(mcu).toBeDefined();
        expect(flash).toBeDefined();
        expect(sd).toBeDefined();
        expect(board).toBeDefined();

        expect(sd?.isEdge).toBe(true);
        // SD_SLOT should be on the edge, outside the flash column
        expect(sd!.gridCol).toBeGreaterThan(flash!.gridCol);
        // SD_SLOT center X should align closely with the board right border (50% overhang)
        const boardRight = board!.x + board!.width;
        const sdCenter = sd!.x + sd!.width / 2;
        expect(Math.abs(sdCenter - boardRight)).toBeLessThanOrEqual(5);
    });

    it('should calculate jumper bridges for crossing wires', () => {
        // Wire 1: horizontal from left to right
        // Wire 2: vertical from top to bottom crossing wire 1
        const dsl = `
            W_LEFT.right -> W_RIGHT.left
            W_TOP.bottom -> W_BOTTOM.top
        `;
        const diagram = parser.parse(dsl);
        // Position them so they cross
        const result = layout.layout(diagram);

        // Verify that wires were calculated
        expect(result.wires.length).toBe(2);
    });

    it('should resolve board boundary connectors when wire leaves a board', () => {
        const dsl = `
            board MAIN_BOARD {
                MCU "ESP32"
            }
            EXT_LCD "LCD"
            MAIN_BOARD.MCU.right ---> EXT_LCD.top : spi via connector("CN1 (FPC 10P)")
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const wire = result.wires.find(w => w.targetId === 'EXT_LCD');
        expect(wire).toBeDefined();
        expect(wire?.boundaryConnectors.length).toBeGreaterThan(0);
        expect(wire?.boundaryConnectors[0].label).toBe('CN1 (FPC 10P)');
    });

    it('should expand MCU height and arrange multiple right-face components vertically', () => {
        const dsl = `
            MCU.right -> FLASH1
            MCU.right -> FLASH2
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const mcu = result.components.find(c => c.id === 'MCU');
        const flash1 = result.components.find(c => c.id === 'FLASH1');
        const flash2 = result.components.find(c => c.id === 'FLASH2');

        expect(mcu).toBeDefined();
        expect(flash1).toBeDefined();
        expect(flash2).toBeDefined();

        // MCU height expands to at least 240 to fit both components vertically
        expect(mcu!.height).toBeGreaterThanOrEqual(240);

        // FLASH1 and FLASH2 are in the same column (to the right of MCU)
        expect(flash1!.x).toBe(flash2!.x);
        expect(flash1!.x).toBeGreaterThan(mcu!.x);

        // FLASH1 and FLASH2 are arranged vertically without overlapping
        expect(flash1!.y).toBeLessThan(flash2!.y);
        expect(flash1!.y + flash1!.height).toBeLessThanOrEqual(flash2!.y);

        // Both wires are straight horizontal lines
        const wire1 = result.wires.find(w => w.targetId === 'FLASH1');
        const wire2 = result.wires.find(w => w.targetId === 'FLASH2');
        expect(wire1).toBeDefined();
        expect(wire2).toBeDefined();
        expect(wire1!.points[0].y).toBe(wire1!.points[1].y);
        expect(wire2!.points[0].y).toBe(wire2!.points[1].y);
    });

    it('should connect vertically aligned components with 2-point straight lines', () => {
        const dsl = `
            USB_C @ edge.top
            USB_C -> LDO : power(5V)
            LDO -> MCU.top : power(3.3V)
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const w1 = result.wires.find(w => w.sourceId === 'USB_C' && w.targetId === 'LDO');
        const w2 = result.wires.find(w => w.sourceId === 'LDO' && w.targetId === 'MCU');

        expect(w1).toBeDefined();
        expect(w2).toBeDefined();
        expect(w1!.points.length).toBe(2);
        expect(w1!.points[0].x).toBe(w1!.points[1].x);
        expect(w2!.points.length).toBe(2);
        expect(w2!.points[0].x).toBe(w2!.points[1].x);
    });

    it('should generate 2-point straight lines for crossing horizontal and vertical connections with jumper', () => {
        const dsl = `
            board ROUTER_BOARD "Router" {
                MCU "SoC"
                NORTH_DEV "North"
                SOUTH_DEV "South"
                WEST_DEV  "West"
                EAST_DEV  "East"
                WEST_DEV.right -> EAST_DEV.left
                NORTH_DEV.bottom -> SOUTH_DEV.top
            }
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const hWire = result.wires.find(w => w.sourceId === 'WEST_DEV');
        const vWire = result.wires.find(w => w.sourceId === 'NORTH_DEV');

        expect(hWire).toBeDefined();
        expect(vWire).toBeDefined();
        expect(hWire!.points.length).toBe(2);
        expect(hWire!.points[0].y).toBe(hWire!.points[1].y);
        expect(vWire!.points.length).toBe(2);
        expect(vWire!.points[0].x).toBe(vWire!.points[1].x);
        expect(vWire!.jumpers.length).toBe(1);
    });

    it('should expand MCU width and arrange multiple bottom-face components horizontally with straight lines', () => {
        const dsl = `
            mcpu.bottom -> flash1
            mcpu.bottom -> flash2
            mcpu.bottom -> flash3
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const mcpu = result.components.find(c => c.id === 'mcpu');
        const flash1 = result.components.find(c => c.id === 'flash1');
        const flash2 = result.components.find(c => c.id === 'flash2');
        const flash3 = result.components.find(c => c.id === 'flash3');

        expect(mcpu).toBeDefined();
        expect(flash1).toBeDefined();
        expect(flash2).toBeDefined();
        expect(flash3).toBeDefined();

        // 1. mcpu width expands to accommodate all 3 components horizontally
        // flash width is 140 each. For 3 components side-by-side with gaps, mcpu width should expand
        expect(mcpu!.width).toBeGreaterThanOrEqual(flash1!.width * 3);
        // ...
        expect(flash1!.y).toBe(flash2!.y);
        expect(flash2!.y).toBe(flash3!.y);
        expect(flash1!.x + flash1!.width).toBeLessThanOrEqual(flash2!.x);
        expect(flash2!.x + flash2!.width).toBeLessThanOrEqual(flash3!.x);

        // 3. flash nodes are connected with straight vertical lines
        const wire1 = result.wires.find(w => w.targetId === 'flash1');
        const wire2 = result.wires.find(w => w.targetId === 'flash2');
        const wire3 = result.wires.find(w => w.targetId === 'flash3');

        expect(wire1).toBeDefined();
        expect(wire2).toBeDefined();
        expect(wire3).toBeDefined();

        expect(wire1!.points.length).toBe(2);
        expect(wire1!.points[0].x).toBe(wire1!.points[1].x);

        expect(wire2!.points.length).toBe(2);
        expect(wire2!.points[0].x).toBe(wire2!.points[1].x);

        expect(wire3!.points.length).toBe(2);
        expect(wire3!.points[0].x).toBe(wire3!.points[1].x);
    });

    it('should expand MCU width and arrange multiple top-face components horizontally with straight lines', () => {
        const dsl = `
            flash1 -> mcpu.top
            flash2 -> mcpu.top
            flash3 -> mcpu.top
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const mcpu = result.components.find(c => c.id === 'mcpu');
        const flash1 = result.components.find(c => c.id === 'flash1');
        const flash2 = result.components.find(c => c.id === 'flash2');
        const flash3 = result.components.find(c => c.id === 'flash3');

        expect(mcpu).toBeDefined();
        expect(flash1).toBeDefined();
        expect(flash2).toBeDefined();
        expect(flash3).toBeDefined();

        // 1. mcpu width expands to accommodate all 3 components horizontally
        expect(mcpu!.width).toBeGreaterThanOrEqual(flash1!.width * 3);

        // 2. flash1, 2, 3 are arranged horizontally without overlap
        expect(flash1!.y).toBe(flash2!.y);
        expect(flash2!.y).toBe(flash3!.y);
        expect(flash1!.x + flash1!.width).toBeLessThanOrEqual(flash2!.x);
        expect(flash2!.x + flash2!.width).toBeLessThanOrEqual(flash3!.x);

        // 3. flash nodes are connected with straight vertical lines
        const wire1 = result.wires.find(w => w.sourceId === 'flash1' && w.targetId === 'mcpu');
        const wire2 = result.wires.find(w => w.sourceId === 'flash2' && w.targetId === 'mcpu');
        const wire3 = result.wires.find(w => w.sourceId === 'flash3' && w.targetId === 'mcpu');

        expect(wire1).toBeDefined();
        expect(wire2).toBeDefined();
        expect(wire3).toBeDefined();

        expect(wire1!.points.length).toBe(2);
        expect(wire1!.points[0].x).toBe(wire1!.points[1].x);

        expect(wire2!.points.length).toBe(2);
        expect(wire2!.points[0].x).toBe(wire2!.points[1].x);

        expect(wire3!.points.length).toBe(2);
        expect(wire3!.points[0].x).toBe(wire3!.points[1].x);
    });

    it('should assign different tracks to prevent collinear overlap when multiple wires jog in the same channel', () => {
        const dsl = `
            board TOP_BOARD {
                A1 "A1"
                A2 "A2"
                A1.right -> A2
            }
            board BOT_BOARD {
                B1 "B1"
                B2 "B2"
                B1.right -> B2
            }
            TOP_BOARD.A1.bottom -> BOT_BOARD.B1.top
            TOP_BOARD.A2.bottom -> BOT_BOARD.B2.top
            TOP_BOARD.A1.bottom -> BOT_BOARD.B2.top
            TOP_BOARD.A2.bottom -> BOT_BOARD.B1.top
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const w1 = result.wires.find(w => w.sourceId === 'A1' && w.targetId === 'B2');
        const w2 = result.wires.find(w => w.sourceId === 'A2' && w.targetId === 'B1');

        expect(w1).toBeDefined();
        expect(w2).toBeDefined();

        // Find horizontal segment of each wire
        const hSeg1 = w1!.points.find((p, i) => i < w1!.points.length - 1 && Math.abs(p.y - w1!.points[i + 1].y) < 0.1);
        const hSeg2 = w2!.points.find((p, i) => i < w2!.points.length - 1 && Math.abs(p.y - w2!.points[i + 1].y) < 0.1);

        expect(hSeg1).toBeDefined();
        expect(hSeg2).toBeDefined();
        // The two horizontal segments must NOT be at the same Y (must be separated into different tracks)
        expect(Math.abs(hSeg1!.y - hSeg2!.y)).toBeGreaterThanOrEqual(10);
    });

    it('should have zero overlapping wire segments and zero overlapping components across gallery wire samples', () => {
        const samples = [
            `# esp32Sensing
board MAIN_BOARD "メイン基板 (Main PCB)" {
  note: "FR-4 / 2層基板 / 板厚 1.6mm"
  MCU "ESP32-S3-WROOM-1" {
    width: 220px
    height: 160px
    color: #E8F0FE
    note: "QFN56 / 3.3V駆動"
  }
  warning for MCU.bottom "5Vトレラント非対応 (Max 3.6V)"
  USB_C "USB Type-C" @ edge.top
  USB_C -> LDO_3V3 "AMS1117-3.3" : power(VBUS 5V)
  LDO_3V3 -> MCU.top             : power(VDD 3.3V)
  MCU.right -> FLASH "W25Q128" .left         : spi(CS: IO11, 80MHz)
  MCU.right -> SD_SLOT "MicroSD Slot" @ edge : spi(CS: IO12)
  MCU.bottom -> bus I2C_BUS : i2c(400kHz, PU: 4.7kΩ) {
    -> SENSOR_TEMP "SHT40"    (addr: 0x44)
    -> SENSOR_IMU  "ICM42688" (addr: 0x68)
  }
  MCU.bottom -> STATUS_LED "LED" .top : gpio(Active-High) [note: "制限抵抗 330Ω"]
}
PC_DEBUG "PC / USB-UART" <---> MAIN_BOARD.USB_C : diff("USB 2.0 FS")
EXT_LCD "ST7789 2.4inch" {
  width: 180px
  height: 240px
}
MAIN_BOARD.MCU.right ---> EXT_LCD.top : spi(CS: IO10) via connector("CN1 (FPC 10P)")`,

            `# chainedTiers
board DAISY_BOARD "Shift Register & SPI Chain" {
  MCU "Main MCU" {
    width: 180px
    height: 140px
    color: #F0FDF4
  }
  MCU.right -> SENSOR_A "Stage 1 (Tier 1)" .left : spi(CS: IO1)
  SENSOR_A.right -> SENSOR_B "Stage 2 (Tier 2)" .left : spi(CS: IO2)
  SENSOR_B.right -> SENSOR_C "Stage 3 (Tier 3)" .left : spi(CS: IO3)
  SENSOR_C.right -> SENSOR_D "Stage 4 (Tier 4)" @ edge : spi(CS: IO4)
}`,

            `# i2cBusTrunk
board SENSOR_HUB "Sensor Hub PCB" {
  MCU "RP2040" {
    width: 200px
    height: 140px
    color: #E0F2FE
  }
  MCU.bottom -> bus I2C_BUS : i2c(400kHz, PU: 2.2kΩ) {
    -> BAROMETER "BMP390"  (addr: 0x76)
    -> ACCEL     "LIS3DH"  (addr: 0x19)
    -> EEPROM    "AT24C32" (addr: 0x50)
    -> RTC       "DS3231"  (addr: 0x68)
  }
  MCU.top -> POWER_BLOCK "TPS62840 (Buck LDO)" : power(3.3V, max: 750mA)
}`,

            `# distanceClearance
board CONTROLLER "Main Controller" {
  MCU "STM32F4" {
    width: 180px
    height: 160px
    color: #EDE7F6
  }
  MCU.right -> SRAM "IS62WV51216" .left : fsmc
  MCU.bottom --> MOTOR_DRIVER "DRV8825" : pwm(DIR/STEP)
  MCU.top ---> LORA_MODULE "SX1262 LoRa" : spi(CS: PA4) [note: "50Ω RF Isolation"]
}`,

            `# manhattanJumpers
board ROUTER_BOARD "Network Switch & Router" {
  MCU "SoC" {
    width: 180px
    height: 180px
    color: #FEF3C7
  }
  NORTH_DEV "North Sensor" { color: #E0E7FF }
  SOUTH_DEV "South Actuator" { color: #E0E7FF }
  WEST_DEV  "West Controller"  { color: #DCFCE7 }
  EAST_DEV  "East Display"  { color: #DCFCE7 }
  WEST_DEV.right -> EAST_DEV.left : uart(115200bps)
  NORTH_DEV.bottom -> SOUTH_DEV.top : power(5V, 2A)
}`,

            `# droneFlightController
board FC_BOARD "Flight Controller (STM32H7)" {
  note: "6層基板 / 3oz銅箔"
  MCU "STM32H743VI" {
    width: 240px
    height: 180px
    color: #FEF08A
    note: "ARM Cortex-M7 480MHz"
  }
  USB_C "USB Type-C" @ edge.top
  USB_C -> LDO "LDO 3.3V" : power(5V)
  LDO -> MCU.top : power(3.3V Clean)
  warning for MCU.bottom "VBAT Max 25.2V (6S LiPo)"
  MCU.left -> IMU_PRIMARY "ICM-42688-P" .right : spi(CS: PB12, 10MHz) [note: "振動作動防止"]
  MCU.left -> IMU_BACKUP  "BMI270"      .right : spi(CS: PC4, 10MHz)
  MCU.right -> OSD_CHIP "AT7456E" @ edge : spi(CS: PB14)
  MCU.right -> BLACKBOX "W25Q256 Flash"  : spi(CS: PB10, 80MHz)
  MCU.bottom -> bus CAN_BUS : diff("CAN-FD 5Mbps") {
    -> ESC_1 "ESC 1 (FL)" (ID: 1)
    -> ESC_2 "ESC 2 (FR)" (ID: 2)
    -> ESC_3 "ESC 3 (RL)" (ID: 3)
    -> ESC_4 "ESC 4 (RR)" (ID: 4)
  }
}
GPS_MAG "M10-5883 GPS/Compass" {
  width: 160px
  height: 100px
}
FC_BOARD.MCU.top ---> GPS_MAG.bottom : uart(115200) via connector("JST-GH 6P")`,

            `# mcpu 3-flash bottom
mcpu.bottom -> flash1
mcpu.bottom -> flash2
mcpu.bottom -> flash3`,

            `# mcpu 3-flash top
flash1 -> mcpu.top
flash2 -> mcpu.top
flash3 -> mcpu.top`
        ];

        for (const dsl of samples) {
            const diagram = parser.parse(dsl);
            const result = layout.layout(diagram);

            // 1. Check component bounding box collisions
            for (let i = 0; i < result.components.length; i++) {
                for (let j = i + 1; j < result.components.length; j++) {
                    const c1 = result.components[i];
                    const c2 = result.components[j];
                    const overlapX = Math.max(0, Math.min(c1.x + c1.width, c2.x + c2.width) - Math.max(c1.x, c2.x));
                    const overlapY = Math.max(0, Math.min(c1.y + c1.height, c2.y + c2.height) - Math.max(c1.y, c2.y));
                    if (overlapX > 0 && overlapY > 0) {
                        expect.fail(`Components ${c1.id} and ${c2.id} collide with overlap ${overlapX}x${overlapY} in DSL:\n${dsl}`);
                    }
                }
            }

            // 2. Check collinear wire segment overlaps
            interface Seg {
                wireId: string;
                p1: { x: number; y: number };
                p2: { x: number; y: number };
                isHorizontal: boolean;
            }
            const segments: Seg[] = [];
            for (const w of result.wires) {
                for (let i = 0; i < w.points.length - 1; i++) {
                    const p1 = w.points[i];
                    const p2 = w.points[i + 1];
                    segments.push({
                        wireId: w.id,
                        p1,
                        p2,
                        isHorizontal: Math.abs(p1.y - p2.y) < 0.1
                    });
                }
            }

            for (let i = 0; i < segments.length; i++) {
                for (let j = i + 1; j < segments.length; j++) {
                    const s1 = segments[i];
                    const s2 = segments[j];
                    if (s1.wireId === s2.wireId) continue;

                    if (s1.isHorizontal && s2.isHorizontal) {
                        if (Math.abs(s1.p1.y - s2.p1.y) < 1) {
                            const min1 = Math.min(s1.p1.x, s1.p2.x);
                            const max1 = Math.max(s1.p1.x, s1.p2.x);
                            const min2 = Math.min(s2.p1.x, s2.p2.x);
                            const max2 = Math.max(s2.p1.x, s2.p2.x);
                            const overlap = Math.min(max1, max2) - Math.max(min1, min2);
                            if (overlap > 1) {
                                expect.fail(`Horizontal wire overlap between ${s1.wireId} and ${s2.wireId} at y=${s1.p1.y}, overlap=${overlap}px in DSL:\n${dsl}`);
                            }
                        }
                    } else if (!s1.isHorizontal && !s2.isHorizontal) {
                        if (Math.abs(s1.p1.x - s2.p1.x) < 1) {
                            const min1 = Math.min(s1.p1.y, s1.p2.y);
                            const max1 = Math.max(s1.p1.y, s1.p2.y);
                            const min2 = Math.min(s2.p1.y, s2.p2.y);
                            const max2 = Math.max(s2.p1.y, s2.p2.y);
                            const overlap = Math.min(max1, max2) - Math.max(min1, min2);
                            if (overlap > 1) {
                                expect.fail(`Vertical wire overlap between ${s1.wireId} and ${s2.wireId} at x=${s1.p1.x}, overlap=${overlap}px in DSL:\n${dsl}`);
                            }
                        }
                    }
                }
            }
        }
    });

    it('should expand MCU width in esp32Sensing and connect STATUS_LED with a straight vertical line', () => {
        const dsl = `
board MAIN_BOARD "メイン基板 (Main PCB)" {
  note: "FR-4 / 2層基板 / 板厚 1.6mm"

  MCU "ESP32-S3-WROOM-1" {
    width: 220px
    height: 160px
    color: #E8F0FE
    note: "QFN56 / 3.3V駆動"
  }

  warning for MCU.bottom "5Vトレラント非対応 (Max 3.6V)"

  # 上面: エッジコネクタから電源生成
  USB_C "USB Type-C" @ edge.top
  USB_C -> LDO_3V3 "AMS1117-3.3" : power(VBUS 5V)
  LDO_3V3 -> MCU.top             : power(VDD 3.3V)

  # 右面: オンボードFlash (Tier 1) と 基板端SDスロット (Edge)
  MCU.right -> FLASH "W25Q128" .left         : spi(CS: IO11, 80MHz)
  MCU.right -> SD_SLOT "MicroSD Slot" @ edge : spi(CS: IO12)

  # 下面: I2Cバス幹線による複数センサーの分岐共有
  MCU.bottom -> bus I2C_BUS : i2c(400kHz, PU: 4.7kΩ) {
    -> SENSOR_TEMP "SHT40"    (addr: 0x44)
    -> SENSOR_IMU  "ICM42688" (addr: 0x68)
  }

  # GPIO インジケータ
  MCU.bottom -> STATUS_LED "LED" .top : gpio(Active-High) [note: "制限抵抗 330Ω"]
}
        `;
        const diagram = parser.parse(dsl);
        const result = layout.layout(diagram);

        const mcu = result.components.find(c => c.id === 'MCU');
        const led = result.components.find(c => c.id === 'STATUS_LED');
        const ledWire = result.wires.find(w => w.targetId === 'STATUS_LED');

        expect(mcu).toBeDefined();
        expect(led).toBeDefined();
        expect(ledWire).toBeDefined();

        // 1. MCU width expands to cover bottom components including STATUS_LED
        expect(mcu!.width).toBeGreaterThanOrEqual(500);

        // 2. STATUS_LED is located directly under the expanded MCU footprint
        expect(led!.x).toBeGreaterThanOrEqual(mcu!.x);
        expect(led!.x + led!.width).toBeLessThanOrEqual(mcu!.x + mcu!.width);

        // 3. Connection to STATUS_LED is a 2-point straight vertical line
        expect(ledWire!.points.length).toBe(2);
        expect(ledWire!.points[0].x).toBe(ledWire!.points[1].x);
    });
});
