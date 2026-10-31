import { describe, it, expect } from 'vitest';
import { renderWireDiagram, render } from '../../src/index';

describe('WireLayout DIY Circuit Samples', () => {
    const samples = {
        arduinoBasicIo: {
            title: 'Arduino Uno 基本入出力 (LED・ボタン・圧電ブザー)',
            code: `# Arduino Uno 基本入出力 (LED・ボタン・圧電ブザー)
board ARDUINO_UNO "Arduino Uno R3 (ATmega328P)" {
  MCU "ATmega328P" {
    width: 200px
    height: 150px
    color: #E0F2FE
    note: "16MHz / 5Vロジック"
  }

  USB_B "USB Type-B (5V Power/Serial)" @ edge.top
  USB_B -> MCU.top : power(5V / UART)

  # 左側: 入力系 (タクトスイッチ & 内蔵プルアップ)
  BUTTON "Tactile Switch" .right -> MCU.left : gpio(D2 / INPUT_PULLUP) [note: "チャタリング防止"]

  # 右側: 出力系 (LED + 抵抗, 圧電ブザー)
  MCU.right -> STATUS_LED "Red LED (D13)" .left : gpio(Active-High) [note: "制限抵抗 330Ω"]
  MCU.right -> BUZZER "Piezo Buzzer (D9)" .left : pwm(Tone 490Hz-4kHz)

  # 下面: アナログ入力 (ボリューム抵抗)
  POTENTIOMETER "10kΩ Potentiometer" .top -> MCU.bottom : analog(A0: 0-5V)
}`
        },

        arduinoLcdWeather: {
            title: 'Arduino Uno + キャラクタLCD & 温湿度計 (HD44780 & DHT11)',
            code: `# Arduino Uno + 1602 キャラクタLCD & 温湿度計
board UNO_WEATHER "Arduino Uno Weather Display" {
  MCU "ATmega328P" {
    width: 220px
    height: 160px
    color: #E0F2FE
  }

  DC_JACK "DC Power Jack (9V)" @ edge.top
  DC_JACK -> REG_5V "Onboard 5V LDO" : power(9V Vin)
  REG_5V -> MCU.top : power(5V VCC)

  # 左面: DHT11温湿度センサー (1-Wireデジタル)
  DHT11 "DHT11 Sensor" .right -> MCU.left : gpio(D2: 1-Wire) [note: "PU: 4.7kΩ"]

  # 右面: 1602 LCD (HD44780 4-bitパラレル)
  MCU.right -> LCD_1602 "1602 LCD Display" .left : gpio(RS, EN, D4-D7) via connector("Header 16P")

  TRIMMER "10kΩ Trimmer" .top -> LCD_1602.bottom : analog(V0 Contrast)
}`
        },

        picoWeatherStation: {
            title: 'Raspberry Pi Pico 気象モニタ (I2C バス幹線 & OLED)',
            code: `# Raspberry Pi Pico 気象モニタ (I2C Bus & OLED)
board PICO_STATION "Raspberry Pi Pico Environmental Station" {
  MCU "RP2040" {
    width: 220px
    height: 150px
    color: #FCE7F3
    note: "Dual Cortex-M0+ 133MHz / 3.3V"
  }

  USB_MICRO "Micro-USB (5V)" @ edge.top
  USB_MICRO -> POWER_REG "RT6150 (Buck-Boost)" : power(VBUS 5V)
  POWER_REG -> MCU.top : power(3.3V OUT)

  warning for MCU.bottom "GPIOは3.3V専用 (5V入力不可)"

  # 下面: I2Cバス幹線 (GP4=SDA, GP5=SCL)
  MCU.bottom -> bus I2C_BUS : i2c(400kHz, PU: 4.7kΩ) {
    -> BME280   "BME280 (Temp/Hum/Press)" (addr: 0x76)
    -> OLED_DSP "SSD1306 0.96 inch OLED"   (addr: 0x3C)
  }

  # 右面: ステータスインジケータ
  MCU.right -> LED_SYS "NeoPixel RGB LED" .left : gpio(GP16, WS2812)
}`
        },

        nanoRobotCar: {
            title: 'Arduino Nano 2WD ロボットカー (L298N & HC-SR04)',
            code: `# Arduino Nano 2WD ロボットカー回路
board NANO_ROBOT "Nano Robot Controller" {
  MCU "Arduino Nano" {
    width: 200px
    height: 160px
    color: #E0F2FE
  }

  BATTERY "2S Li-ion Battery (7.4V)" @ edge.top
  BATTERY -> MCU.top : power(7.4V to VIN)

  # 左面: 超音波距離センサー HC-SR04
  ULTRASONIC "HC-SR04 Ultrasonic" .right -> MCU.left : gpio(Trig: D8, Echo: D9)

  # 右面: L298N H-Bridge モータードライバ
  MCU.right -> DRIVER_L298N "L298N Motor Driver" .left : pwm(ENA, ENB / IN1-4)
}

# 外部モーター接続
MOTOR_L "Left DC Motor"
MOTOR_R "Right DC Motor"
NANO_ROBOT.DRIVER_L298N.bottom -> MOTOR_L : power(OUT1, OUT2)
NANO_ROBOT.DRIVER_L298N.bottom -> MOTOR_R : power(OUT3, OUT4)`
        },

        rpi4SmartHome: {
            title: 'Raspberry Pi 4 スマート家電制御 (フォトカプラ絶縁リレー & 人感センサー)',
            code: `# Raspberry Pi 4 スマート家電制御回路
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
RPI4_HUB.RELAY_MOD.right ---> AC_LAMP.left : power(100V 2A Relay NO/COM) via connector("Terminal Block")`
        },

        esp32SmartPlanter: {
            title: 'ESP32 スマート自動給水プランター (土壌湿度 & MOSFETポンプ)',
            code: `# ESP32 スマート自動給水プランター
board SMART_PLANTER "Plant Monitor & Irrigation PCB" {
  MCU "ESP32-WROOM-32" {
    width: 220px
    height: 160px
    color: #E8F0FE
    note: "Wi-Fi & BLE / ADC: 12-bit"
  }

  USB_IN "Micro-USB 5V" @ edge.top
  USB_IN -> REG_3V3 "AMS1117-3.3" : power(5V)
  REG_3V3 -> MCU.top : power(3.3V VDD)

  # 左面: センサー入力系
  SOIL_SENSE "Capacitive Moisture v1.2" .right -> MCU.left : analog(IO34: 0-3.3V ADC)
  DHT22_AM2302 "DHT22 (Air Temp/Hum)" .right   -> MCU.left : gpio(IO4: 1-Wire)

  # 右面: MOSFET ポンプドライバー
  MCU.right -> MOSFET_DVR "IRLML2502 (N-ch FET)" .left : gpio(IO16 Gate) [note: "Flyback Diode 保護"]
}

WATER_PUMP "5V Micro Submersible Pump"
SMART_PLANTER.MOSFET_DVR.right --> WATER_PUMP.left : power(5V Drain Switch)`
        },

        rpiZeroCam: {
            title: 'Raspberry Pi Zero 2 W 見守りカメラ (CSIカメラ & NeoPixel LED)',
            code: `# Raspberry Pi Zero 2 W 小型見守りカメラ
board RPI_ZERO_CAM "Raspberry Pi Zero 2 W" {
  SOC "RP3A0 (SiP SoC)" {
    width: 200px
    height: 150px
    color: #FEF3C7
  }

  USB_PWR "Micro-USB Power" @ edge.top
  USB_PWR -> SOC.top : power(5V 2.5A)

  # 下面: I2C照度センサー
  SOC.bottom -> LIGHT_SENSOR "BH1750 (Ambient Light)" .top : i2c(addr: 0x23)

  # 右面: WS2812B NeoPixel 8連リング (補助照明)
  SOC.right -> NEO_RING "WS2812B 8-LED Ring" .left : gpio(GPIO 18 / PWM) [note: "DIN 470Ω 保護"]
}

CAM_MOD "RPi Camera Module 3" {
  width: 170px
  height: 120px
}
RPI_ZERO_CAM.SOC.left ---> CAM_MOD.right : diff("CSI-2 2-Lane MIPI") via connector("15-pin FPC 0.5mm")`
        },

        nanoDataLogger: {
            title: 'Arduino Nano フィールドデータロガー (SPI MicroSD & DS3231 RTC)',
            code: `# Arduino Nano フィールドデータロガー
board NANO_LOGGER "Field Data Logger Shield" {
  MCU "Arduino Nano (ATmega328P)" {
    width: 230px
    height: 160px
    color: #E0F2FE
  }

  EXT_BAT "9V 006P Battery" @ edge.top
  EXT_BAT -> MCU.top : power(VIN 9V)

  # 左面: アナログセンサー & I2C 高精度時計
  CDS_DIVIDER "CdS Photoresistor" .right -> MCU.left : analog(A0: 10kΩ 分圧)
  MCU.left -> RTC_DS3231 "DS3231 High-Precision RTC" .right : i2c(addr: 0x68, 32kHz TCXO)

  # 右面: SPI 高速MicroSDカードスロット
  MCU.right -> SD_MODULE "MicroSD Card Slot" @ edge : spi(CS: D4, MOSI: D11, MISO: D12, SCK: D13)

  warning for SD_MODULE.bottom "SDカードは3.3V駆動 (レベルシフタ要)"
}`
        },

        picoPanTilt: {
            title: 'Raspberry Pi Pico 2軸パンチルトカメラ台 (PCA9685 & SG90サーボ)',
            code: `# Raspberry Pi Pico 2軸パンチルト サーボ制御
board PICO_ROBOTICS "Pico Servo Controller" {
  MCU "RP2040" {
    width: 220px
    height: 160px
    color: #FCE7F3
  }

  # 左面: 2軸アナログジョイスティック入力
  JOYSTICK "2-Axis Analog Joystick" .right -> MCU.left : analog(X: GP26/ADC0, Y: GP27/ADC1)

  # 右面: I2C 16ch PWM コントローラ
  MCU.right -> PWM_DRIVER "PCA9685 16ch PWM" .left : i2c(addr: 0x40, 12-bit)
}

# 外部サーボ電源 (サーボの突入電流からMCUを保護)
SERVO_BAT "External 5V 3A UBEC" -> PICO_ROBOTICS.PWM_DRIVER.top : power(5V V+ Servo Rail)

SERVO_PAN  "SG90 Micro Servo (Pan / X)"
SERVO_TILT "SG90 Micro Servo (Tilt / Y)"
PICO_ROBOTICS.PWM_DRIVER.right --> SERVO_PAN.left  : pwm(CH0: 50Hz Pulse)
PICO_ROBOTICS.PWM_DRIVER.right --> SERVO_TILT.left : pwm(CH1: 50Hz Pulse)`
        },

        proMiniLora: {
            title: 'Arduino Pro Mini 太陽光充電式 LoRa 環境ノード (SX1278 & BME680)',
            code: `# Arduino Pro Mini 太陽光充電式 LoRa リモートノード
board LORA_NODE "LoRa Low-Power Sensor PCB" {
  MCU "ATmega328P (3.3V 8MHz)" {
    width: 230px
    height: 160px
    color: #ECFDF5
    note: "Sleep電流 < 5µA (LED/レギュレータ除去済)"
  }

  SOLAR_CELL "Solar Panel (5V 1W)" @ edge.top
  SOLAR_CELL -> CHG_CTRL "CN3065 Solar Charger" : power(5V Solar)
  CHG_CTRL -> LIFEPO4 "LiFePO4 3.2V Cell" : power(3.6V Charge)
  LIFEPO4 -> MCU.top : power(3.2V Direct VBAT)

  # 左面: I2C 複合環境センサー (温度/湿度/気圧/VOCガス)
  MCU.left -> BME680 "BME680 Gas & Weather" .right : i2c(addr: 0x77)

  # 右面: SPI 長距離 LoRa 無線モジュール
  MCU.right -> LORA_RFM "SX1278 / RFM95W LoRa" @ edge : spi(CS: D10, DIO0: D2) [note: "920MHz 帯 / 長距離通信"]
}`
        }
    };

    Object.entries(samples).forEach(([key, sample]) => {
        it(`should successfully parse and render sample: ${key} (${sample.title})`, () => {
            const svgDirect = renderWireDiagram(sample.code);
            expect(svgDirect).toContain('<svg');
            expect(svgDirect).not.toContain('<text x="20" y="50" fill="#ff0000"');

            const svgRender = render(sample.code);
            expect(svgRender).toContain('<svg');
            expect(svgRender).not.toContain('<text x="20" y="50" fill="#ff0000"');
        });
    });

    it('should verify detailed SVG contents for the DIY samples', () => {
        const svg1 = render(samples.arduinoBasicIo.code);
        expect(svg1).toContain('Arduino Uno R3 (ATmega328P)');
        expect(svg1).toContain('Tactile Switch');
        expect(svg1).toContain('Red LED (D13)');
        expect(svg1).toContain('Piezo Buzzer (D9)');

        const svg3 = render(samples.picoWeatherStation.code);
        expect(svg3).toContain('Raspberry Pi Pico Environmental Station');
        expect(svg3).toContain('BME280 (Temp/Hum/Press)');
        expect(svg3).toContain('SSD1306 0.96 inch OLED');

        const svg4 = render(samples.nanoRobotCar.code);
        expect(svg4).toContain('Nano Robot Controller');
        expect(svg4).toContain('L298N Motor Driver');
        expect(svg4).toContain('Left DC Motor');

        const svg9 = render(samples.picoPanTilt.code);
        expect(svg9).toContain('PCA9685 16ch PWM');
        expect(svg9).toContain('SG90 Micro Servo (Pan / X)');

        const svg10 = render(samples.proMiniLora.code);
        expect(svg10).toContain('LoRa Low-Power Sensor PCB');
        expect(svg10).toContain('SX1278 / RFM95W LoRa');
    });
});
