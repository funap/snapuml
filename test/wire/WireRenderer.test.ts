import { describe, it, expect } from 'vitest';
import { WireParser } from '../../src/diagrams/wire/WireParser';
import { WireLayout } from '../../src/diagrams/wire/WireLayout';
import { WireRenderer } from '../../src/diagrams/wire/WireRenderer';

describe('WireRenderer', () => {
    const parser = new WireParser();
    const renderer = new WireRenderer();

    it('should render a basic wire layout diagram to valid SVG', () => {
        const dsl = `
            MCU.right -> FLASH
        `;
        const diagram = parser.parse(dsl);
        const svg = renderer.render(diagram);

        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
        expect(svg).toContain('MCU');
        expect(svg).toContain('FLASH');
    });

    it('should render board with header, note, and components', () => {
        const dsl = `
            board MAIN_BOARD "メイン基板" {
                note: "FR-4 / 2層基板"
                MCU "ESP32-S3" {
                    color: #E8F0FE
                }
            }
        `;
        const diagram = parser.parse(dsl);
        const svg = renderer.render(diagram);

        expect(svg).toContain('MAIN_BOARD');
        expect(svg).toContain('メイン基板');
        expect(svg).toContain('FR-4 / 2層基板');
        expect(svg).toContain('ESP32-S3');
        expect(svg).toContain('#E8F0FE');
    });

    it('should render protocol sugar: power, spi, diff', () => {
        const dsl = `
            A -> B : power(3.3V, max: 500mA)
            C -> D : diff("USB 2.0")
            E -> F : spi(CS: IO10)
        `;
        const diagram = parser.parse(dsl);
        const svg = renderer.render(diagram);

        expect(svg).toContain('power');
        expect(svg).toContain('3.3V');
        expect(svg).toContain('diff');
        expect(svg).toContain('USB 2.0');
        expect(svg).toContain('spi');
    });

    it('should render bus trunk with taps and addr labels', () => {
        const dsl = `
            MCU.bottom -> bus I2C_BUS : i2c(400kHz) {
                -> SENSOR1 "TEMP" (addr: 0x44)
                -> SENSOR2 "IMU"  (addr: 0x68)
            }
        `;
        const diagram = parser.parse(dsl);
        const svg = renderer.render(diagram);

        expect(svg).toContain('I2C_BUS');
        expect(svg).toContain('i2c(400kHz)');
        expect(svg).toContain('TEMP');
        expect(svg).toContain('IMU');
        expect(svg).toContain('0x44');
        expect(svg).toContain('0x68');
    });

    it('should render callout warning and note with leader lines', () => {
        const dsl = `
            MCU "ESP32"
            warning for MCU.bottom "5Vトレラント非対応"
        `;
        const diagram = parser.parse(dsl);
        const svg = renderer.render(diagram);

        expect(svg).toContain('5Vトレラント非対応');
        expect(svg).toContain('stroke-dasharray'); // leader line
    });

    it('should render the complete Section 3 Practical Sample', () => {
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
        const svg = renderer.render(diagram);

        expect(svg).toContain('<svg');
        expect(svg).toContain('ESP32-S3-WROOM-1');
        expect(svg).toContain('USB Type-C');
        expect(svg).toContain('AMS1117-3.3');
        expect(svg).toContain('W25Q128');
        expect(svg).toContain('MicroSD Slot');
        expect(svg).toContain('I2C_BUS');
        expect(svg).toContain('SHT40');
        expect(svg).toContain('ICM42688');
        expect(svg).toContain('5Vトレラント非対応');
        expect(svg).toContain('PC / USB-UART');
        expect(svg).toContain('ST7789 2.4inch');
        expect(svg).toContain('CN1 (FPC 10P)');
        expect(svg).toContain('制限抵抗 330Ω');
    });

    it('should render vertically stacked components on right face with straight horizontal wires', () => {
        const dsl = `
            MCU.right -> FLASH1
            MCU.right -> FLASH2
        `;
        const diagram = parser.parse(dsl);
        const svg = renderer.render(diagram);

        expect(svg).toContain('FLASH1');
        expect(svg).toContain('FLASH2');

        // Extract component rect Y positions
        const matchF1 = svg.match(/id="comp-FLASH1"[^>]*>[\s\S]*?<rect x="([^"]+)" y="([^"]+)"/);
        const matchF2 = svg.match(/id="comp-FLASH2"[^>]*>[\s\S]*?<rect x="([^"]+)" y="([^"]+)"/);

        expect(matchF1).not.toBeNull();
        expect(matchF2).not.toBeNull();

        const x1 = parseFloat(matchF1![1]);
        const y1 = parseFloat(matchF1![2]);
        const x2 = parseFloat(matchF2![1]);
        const y2 = parseFloat(matchF2![2]);

        // Same column
        expect(x1).toBe(x2);
        // Different Y: FLASH2 is below FLASH1
        expect(y2).toBeGreaterThan(y1);
    });
});
