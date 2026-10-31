import { describe, it, expect } from 'vitest';
import { WireParser } from '../../src/diagrams/wire/WireParser';

describe('WireParser', () => {
    const parser = new WireParser();

    it('should parse component declaration with width, height, color, and note', () => {
        const dsl = `
            MCU "ESP32-S3-WROOM-1" {
                width: 220px
                height: 160px
                color: #E8F0FE
                note: "QFN56 / 3.3V駆動"
            }
        `;
        const diagram = parser.parse(dsl);
        const mcu = diagram.getComponent('MCU');
        expect(mcu).toBeDefined();
        expect(mcu?.label).toBe('ESP32-S3-WROOM-1');
        expect(mcu?.userWidth).toBe(220);
        expect(mcu?.widthUnit).toBe('px');
        expect(mcu?.userHeight).toBe(160);
        expect(mcu?.heightUnit).toBe('px');
        expect(mcu?.color).toBe('#E8F0FE');
        expect(mcu?.note).toBe('QFN56 / 3.3V駆動');
    });

    it('should parse component with slots unit', () => {
        const dsl = `
            TFT_LCD "ST7789 LCD" {
                width: 180px
                height: 3slots
            }
        `;
        const diagram = parser.parse(dsl);
        const lcd = diagram.getComponent('TFT_LCD');
        expect(lcd).toBeDefined();
        expect(lcd?.userHeight).toBe(3);
        expect(lcd?.heightUnit).toBe('slots');
    });

    it('should parse edge component declaration', () => {
        const dsl = `
            USB_C "USB Type-C" @ edge.top
        `;
        const diagram = parser.parse(dsl);
        const usb = diagram.getComponent('USB_C');
        expect(usb).toBeDefined();
        expect(usb?.label).toBe('USB Type-C');
        expect(usb?.isEdge).toBe(true);
        expect(usb?.edgeFace).toBe('top');
    });

    it('should parse basic wiring statement with faces and protocol', () => {
        const dsl = `
            MCU.right -> FLASH "W25Q128" .left : spi(CS: IO11, 80MHz)
        `;
        const diagram = parser.parse(dsl);
        expect(diagram.wires.length).toBe(1);
        const wire = diagram.wires[0];
        expect(wire.sourceId).toBe('MCU');
        expect(wire.sourceFace).toBe('right');
        expect(wire.targetId).toBe('FLASH');
        expect(wire.targetFace).toBe('left');
        expect(wire.arrow.direction).toBe('forward');
        expect(wire.arrow.distance).toBe(1);
        expect(wire.protocol?.name).toBe('spi');
        expect(wire.protocol?.args).toContain('CS: IO11');

        const flash = diagram.getComponent('FLASH');
        expect(flash?.label).toBe('W25Q128');
    });

    it('should parse arrow lengths and distances (--> = 2, ---> = 3)', () => {
        const dsl = `
            A --> B
            C ---> D
            E <---> F
        `;
        const diagram = parser.parse(dsl);
        expect(diagram.wires.length).toBe(3);
        expect(diagram.wires[0].arrow.distance).toBe(2);
        expect(diagram.wires[1].arrow.distance).toBe(3);
        expect(diagram.wires[2].arrow.distance).toBe(3);
        expect(diagram.wires[2].arrow.direction).toBe('bidirectional');
    });

    it('should parse board block with note, internal components, and bus syntax', () => {
        const dsl = `
            board MAIN_BOARD "メイン基板 (Main PCB)" {
                note: "FR-4 / 2層基板 / 板厚 1.6mm"

                MCU "ESP32-S3" {
                    width: 200px
                }

                MCU.bottom -> bus I2C_BUS : i2c(400kHz, PU: 4.7kΩ) {
                    -> SENSOR_TEMP "SHT40"    (addr: 0x44)
                    -> SENSOR_IMU  "ICM42688" (addr: 0x68)
                }

                MCU.bottom -> STATUS_LED "LED" .top : gpio(Active-High) [note: "制限抵抗 330Ω"]
            }
        `;
        const diagram = parser.parse(dsl);
        const board = diagram.boards.get('MAIN_BOARD');
        expect(board).toBeDefined();
        expect(board?.label).toBe('メイン基板 (Main PCB)');
        expect(board?.note).toBe('FR-4 / 2層基板 / 板厚 1.6mm');
        expect(board?.componentIds).toContain('MCU');
        expect(board?.componentIds).toContain('SENSOR_TEMP');
        expect(board?.componentIds).toContain('SENSOR_IMU');
        expect(board?.componentIds).toContain('STATUS_LED');

        const busWire = diagram.wires.find(w => w.isBus);
        expect(busWire).toBeDefined();
        expect(busWire?.busId).toBe('I2C_BUS');
        expect(busWire?.protocol?.name).toBe('i2c');
        expect(busWire?.busChildren?.length).toBe(2);
        expect(busWire?.busChildren?.[0].targetId).toBe('SENSOR_TEMP');
        expect(busWire?.busChildren?.[0].noteOrAddr).toBe('addr: 0x44');

        const ledWire = diagram.wires.find(w => w.targetId === 'STATUS_LED');
        expect(ledWire).toBeDefined();
        expect(ledWire?.note).toBe('制限抵抗 330Ω');
        expect(ledWire?.protocol?.name).toBe('gpio');
    });

    it('should parse callouts: note for, warning for, and note @ near', () => {
        const dsl = `
            warning for MCU.bottom "5Vトレラント非対応 (Max 3.6V)"
            note for MCU "電源シーケンス注意"
            note "TODO: 回路定数確認" @ near(LDO_3V3)
        `;
        const diagram = parser.parse(dsl);
        expect(diagram.callouts.length).toBe(3);

        const w = diagram.callouts[0];
        expect(w.type).toBe('warning');
        expect(w.targetId).toBe('MCU');
        expect(w.targetFace).toBe('bottom');
        expect(w.text).toBe('5Vトレラント非対応 (Max 3.6V)');

        const n1 = diagram.callouts[1];
        expect(n1.type).toBe('note');
        expect(n1.targetId).toBe('MCU');
        expect(n1.text).toBe('電源シーケンス注意');

        const n2 = diagram.callouts[2];
        expect(n2.type).toBe('note');
        expect(n2.nearId).toBe('LDO_3V3');
        expect(n2.text).toBe('TODO: 回路定数確認');
    });

    it('should parse external wiring with connector spec', () => {
        const dsl = `
            MAIN_BOARD.MCU.right ---> EXT_LCD.top : spi(CS: IO10) via connector("CN1 (FPC 10P)")
        `;
        const diagram = parser.parse(dsl);
        expect(diagram.wires.length).toBe(1);
        const wire = diagram.wires[0];
        expect(wire.sourceId).toBe('MCU');
        expect(wire.sourceFace).toBe('right');
        expect(wire.targetId).toBe('EXT_LCD');
        expect(wire.targetFace).toBe('top');
        expect(wire.arrow.distance).toBe(3);
        expect(wire.connector).toBe('CN1 (FPC 10P)');
    });

    it('should parse the complete practical sample from Section 3 without errors', () => {
        const dsl = `
# ==========================================
# ESP32-S3 センシング基板 回路構成図
# ==========================================

# 1. メイン基板
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

# 2. 外部モジュール接続 (矢印長によるクリアランス・距離指定を活用)
PC_DEBUG "PC / USB-UART" <---> MAIN_BOARD.USB_C : diff("USB 2.0 FS")

EXT_LCD "ST7789 2.4inch" {
  width: 180px
  height: 240px
}
MAIN_BOARD.MCU.right ---> EXT_LCD.top : spi(CS: IO10) via connector("CN1 (FPC 10P)")
        `;

        const diagram = parser.parse(dsl);
        expect(diagram.boards.has('MAIN_BOARD')).toBe(true);
        expect(diagram.components.has('MCU')).toBe(true);
        expect(diagram.components.has('USB_C')).toBe(true);
        expect(diagram.components.has('LDO_3V3')).toBe(true);
        expect(diagram.components.has('FLASH')).toBe(true);
        expect(diagram.components.has('SD_SLOT')).toBe(true);
        expect(diagram.components.has('SENSOR_TEMP')).toBe(true);
        expect(diagram.components.has('SENSOR_IMU')).toBe(true);
        expect(diagram.components.has('STATUS_LED')).toBe(true);
        expect(diagram.components.has('PC_DEBUG')).toBe(true);
        expect(diagram.components.has('EXT_LCD')).toBe(true);
        expect(diagram.wires.length).toBe(8);
        expect(diagram.callouts.length).toBe(1);
    });
});
