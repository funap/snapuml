import { describe, it, expect } from 'vitest';
import { render, renderWireDiagram, renderWireLayout } from '../../src/index';

describe('Wire Integration', () => {
    it('should export renderWireDiagram and renderWireLayout', () => {
        expect(typeof renderWireDiagram).toBe('function');
        expect(typeof renderWireLayout).toBe('function');
    });

    it('should automatically detect WireLayout DSL using render()', () => {
        const dsl = `
            MCU.right -> FLASH
        `;
        const svg = render(dsl);
        expect(svg).toContain('<svg');
        expect(svg).toContain('comp-MCU');
        expect(svg).toContain('comp-FLASH');
    });

    it('should automatically detect WireLayout DSL with board syntax', () => {
        const dsl = `
            board PCB "Controller Board" {
                MCU "ESP32"
            }
        `;
        const svg = render(dsl);
        expect(svg).toContain('<svg');
        expect(svg).toContain('board-PCB');
        expect(svg).toContain('Controller Board');
        expect(svg).toContain('comp-MCU');
    });

    it('should render the full practical sample via render()', () => {
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
        const svg = render(dsl);
        expect(svg).toContain('<svg');
        expect(svg).toContain('ESP32-S3-WROOM-1');
        expect(svg).toContain('メイン基板 (Main PCB)');
        expect(svg).toContain('FR-4 / 2層基板 / 板厚 1.6mm');
        expect(svg).toContain('USB Type-C');
        expect(svg).toContain('AMS1117-3.3');
        expect(svg).toContain('W25Q128');
        expect(svg).toContain('MicroSD Slot');
        expect(svg).toContain('I2C_BUS');
        expect(svg).toContain('SHT40');
        expect(svg).toContain('ICM42688');
        expect(svg).toContain('5Vトレラント非対応 (Max 3.6V)');
        expect(svg).toContain('PC / USB-UART');
        expect(svg).toContain('ST7789 2.4inch');
        expect(svg).toContain('CN1 (FPC 10P)');
        expect(svg).toContain('制限抵抗 330Ω');
    });

    it('should render chainedTiers sample via renderWireDiagram and render', () => {
        const dsl = `# 多段連鎖と階層展開 (Chained Anchors & Multi-Tier)
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
}`;
        const svg1 = renderWireDiagram(dsl);
        expect(svg1).toContain('<svg');
        expect(svg1).not.toContain('<text x="20" y="50" fill="#ff0000"');
        expect(svg1).toContain('DAISY_BOARD');
        expect(svg1).toContain('SENSOR_A');
        expect(svg1).toContain('SENSOR_D');

        const svg2 = render(dsl);
        expect(svg2).toContain('<svg');
        expect(svg2).not.toContain('<text x="20" y="50" fill="#ff0000"');
    });

    it('should render i2cBusTrunk sample via renderWireDiagram and render', () => {
        const dsl = `# I2C バス共有幹線とT字タップ (I2C Bus Trunk & T-Junctions)
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
}`;
        const svg1 = renderWireDiagram(dsl);
        expect(svg1).toContain('<svg');
        expect(svg1).not.toContain('<text x="20" y="50" fill="#ff0000"');
        expect(svg1).toContain('SENSOR_HUB');
        expect(svg1).toContain('RP2040');
        expect(svg1).toContain('BMP390');

        const svg2 = render(dsl);
        expect(svg2).toContain('<svg');
        expect(svg2).not.toContain('<text x="20" y="50" fill="#ff0000"');
    });

    it('should render distanceClearance sample via renderWireDiagram and render', () => {
        const dsl = `# 矢印長による距離・間隔指定 (Distance & Isolation Clearance)
board CONTROLLER "Main Controller" {
  MCU "STM32F4" {
    width: 180px
    height: 160px
    color: #EDE7F6
  }

  # 距離1: 隣接スロット直結
  MCU.right -> SRAM "IS62WV51216" .left : fsmc

  # 距離2: 熱分散のため1スロット空きギャップ
  MCU.bottom --> MOTOR_DRIVER "DRV8825" : pwm(DIR/STEP)

  # 距離3: RF干渉防止のため2スロット空きアイソレーション領域
  MCU.top ---> LORA_MODULE "SX1262 LoRa" : spi(CS: PA4) [note: "50Ω RF Isolation"]
}`;
        const svg1 = renderWireDiagram(dsl);
        expect(svg1).toContain('<svg');
        expect(svg1).not.toContain('<text x="20" y="50" fill="#ff0000"');
        expect(svg1).toContain('CONTROLLER');
        expect(svg1).toContain('STM32F4');
        expect(svg1).toContain('SX1262 LoRa');

        const svg2 = render(dsl);
        expect(svg2).toContain('<svg');
        expect(svg2).not.toContain('<text x="20" y="50" fill="#ff0000"');
    });

    it('should render manhattanJumpers sample via renderWireDiagram and render', () => {
        const dsl = `# 直交配線と交差解決標準 (Manhattan Routing & Jumpers)
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

  # 水平線（地・直線）:
  WEST_DEV.right -> EAST_DEV.left : uart(115200bps)

  # 垂直線（交差跨ぎ・半円ジャンパブリッジ）:
  NORTH_DEV.bottom -> SOUTH_DEV.top : power(5V, 2A)
}`;
        const svg1 = renderWireDiagram(dsl);
        expect(svg1).toContain('<svg');
        expect(svg1).not.toContain('<text x="20" y="50" fill="#ff0000"');
        expect(svg1).toContain('ROUTER_BOARD');
        expect(svg1).toContain('SoC');

        const svg2 = render(dsl);
        expect(svg2).toContain('<svg');
        expect(svg2).not.toContain('<text x="20" y="50" fill="#ff0000"');
    });

    it('should render droneFlightController sample via renderWireDiagram and render', () => {
        const dsl = `# フライトコントローラ回路 (Drone Flight Controller Architecture)
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
FC_BOARD.MCU.top ---> GPS_MAG.bottom : uart(115200) via connector("JST-GH 6P")`;
        const svg1 = renderWireDiagram(dsl);
        expect(svg1).toContain('<svg');
        expect(svg1).not.toContain('<text x="20" y="50" fill="#ff0000"');
        expect(svg1).toContain('FC_BOARD');
        expect(svg1).toContain('STM32H743VI');
        expect(svg1).toContain('M10-5883 GPS/Compass');

        const svg2 = render(dsl);
        expect(svg2).toContain('<svg');
        expect(svg2).not.toContain('<text x="20" y="50" fill="#ff0000"');
    });

    it('should render multiple bottom-face components connected to mcpu with straight lines', () => {
        const dsl = `
            mcpu.bottom -> flash1
            mcpu.bottom -> flash2
            mcpu.bottom -> flash3
        `;
        const svg = render(dsl);
        expect(svg).toContain('<svg');
        expect(svg).toContain('comp-mcpu');
        expect(svg).toContain('comp-flash1');
        expect(svg).toContain('comp-flash2');
        expect(svg).toContain('comp-flash3');
        expect(svg).not.toContain('<text x="20" y="50" fill="#ff0000"');
    });
});
