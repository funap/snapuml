import { describe, it, expect } from 'vitest';
import { renderWireDiagram, render } from '../../src/index';

describe('WireLayout DIY Circuit Samples', () => {
    const samples = {
        arduinoBasicIo: {
            title: 'Arduino Uno Basic I/O (LED, Button, Buzzer)',
            code: `# Arduino Uno Basic I/O (LED, Button, Buzzer)
board ARDUINO_UNO "Arduino Uno R3 (ATmega328P)" {
  MCU "ATmega328P" {
    width: 200px
    height: 150px
    color: #E0F2FE
    note: "16MHz / 5V Logic"
  }

  USB_B "USB Type-B (5V Power/Serial)" @ edge.top
  USB_B -> MCU.top : power(5V / UART)

  # Left: Inputs (Tactile switch & internal pull-up)
  BUTTON "Tactile Switch" .right -> MCU.left : gpio(D2 / INPUT_PULLUP) [note: "Debounced"]

  # Right: Outputs (LED + resistor, piezo buzzer)
  MCU.right -> STATUS_LED "Red LED (D13)" .left : gpio(Active-High) [note: "330Ω Current Limiting Resistor"]
  MCU.right -> BUZZER "Piezo Buzzer (D9)" .left : pwm(Tone 490Hz-4kHz)

  # Bottom: Analog input (Potentiometer)
  POTENTIOMETER "10kΩ Potentiometer" .top -> MCU.bottom : analog(A0: 0-5V)
}`
        },

        arduinoLcdWeather: {
            title: 'Arduino Uno + Character LCD & Temp/Humidity (HD44780 & DHT11)',
            code: `# Arduino Uno + 1602 Character LCD & Weather Display
board UNO_WEATHER "Arduino Uno Weather Display" {
  MCU "ATmega328P" {
    width: 220px
    height: 160px
    color: #E0F2FE
  }

  DC_JACK "DC Power Jack (9V)" @ edge.top
  DC_JACK -> REG_5V "Onboard 5V LDO" : power(9V Vin)
  REG_5V -> MCU.top : power(5V VCC)

  # Left: DHT11 temperature & humidity sensor (1-Wire digital)
  DHT11 "DHT11 Sensor" .right -> MCU.left : gpio(D2: 1-Wire) [note: "PU: 4.7kΩ"]

  # Right: 1602 LCD (HD44780 4-bit parallel)
  MCU.right -> LCD_1602 "1602 LCD Display" .left : gpio(RS, EN, D4-D7) via connector("Header 16P")

  TRIMMER "10kΩ Trimmer" .top -> LCD_1602.bottom : analog(V0 Contrast)
}`
        },

        picoWeatherStation: {
            title: 'Raspberry Pi Pico Weather Station (I2C Bus & OLED)',
            code: `# Raspberry Pi Pico Weather Station (I2C Bus & OLED)
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

  warning for MCU.bottom "GPIO is 3.3V only (No 5V input)"

  # Bottom: I2C bus trunk (GP4=SDA, GP5=SCL)
  MCU.bottom -> bus I2C_BUS : i2c(400kHz, PU: 4.7kΩ) {
    -> BME280   "BME280 (Temp/Hum/Press)" (addr: 0x76)
    -> OLED_DSP "SSD1306 0.96 inch OLED"   (addr: 0x3C)
  }

  # Right: Status indicator
  MCU.right -> LED_SYS "NeoPixel RGB LED" .left : gpio(GP16, WS2812)
}`
        },

        nanoRobotCar: {
            title: 'Arduino Nano 2WD Robot Car (L298N & HC-SR04)',
            code: `# Arduino Nano 2WD Robot Car Circuit
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
NANO_ROBOT.DRIVER_L298N.bottom -> MOTOR_R : power(OUT3, OUT4)`
        },

        rpi4SmartHome: {
            title: 'Raspberry Pi 4 Smart Appliance Control (Optocoupled Relay & PIR Sensor)',
            code: `# Raspberry Pi 4 Smart Appliance Control Circuit
board RPI4_HUB "Raspberry Pi 4 IoT Hub" {
  SOC "BCM2711 (RPi 4)" {
    width: 220px
    height: 160px
    color: #DCFCE7
    note: "Quad Cortex-A72 / 3.3V GPIO"
  }

  TYPE_C "USB Type-C (5V 3A)" @ edge.top
  TYPE_C -> SOC.top : power(5.1V / 3A)

  # Left: PIR motion sensor
  PIR_SENSOR "HC-SR501 PIR" .right -> SOC.left : gpio(GPIO 17, 3.3V Out)

  # Right: Optocoupler-isolated 4-ch relay
  SOC.right -> RELAY_MOD "4ch Optocoupled Relay" .left : gpio(Active-Low: GPIO 22-25)

  warning for RELAY_MOD.right "AC 100V High-Voltage Isolation (Danger)"
}

AC_LAMP "AC 100V Desk Lamp"
RPI4_HUB.RELAY_MOD.right ---> AC_LAMP.left : power(100V 2A Relay NO/COM) via connector("Terminal Block")`
        },

        esp32SmartPlanter: {
            title: 'ESP32 Smart Automated Planter (Soil Moisture & MOSFET Pump)',
            code: `# ESP32 Smart Automated Planter
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

  # Left: Sensor inputs
  SOIL_SENSE "Capacitive Moisture v1.2" .right -> MCU.left : analog(IO34: 0-3.3V ADC)
  DHT22_AM2302 "DHT22 (Air Temp/Hum)" .right   -> MCU.left : gpio(IO4: 1-Wire)

  # Right: MOSFET pump driver
  MCU.right -> MOSFET_DVR "IRLML2502 (N-ch FET)" .left : gpio(IO16 Gate) [note: "Flyback Diode Protection"]
}

WATER_PUMP "5V Micro Submersible Pump"
SMART_PLANTER.MOSFET_DVR.right --> WATER_PUMP.left : power(5V Drain Switch)`
        },

        rpiZeroCam: {
            title: 'Raspberry Pi Zero 2 W Security Camera (CSI Camera & NeoPixel LED)',
            code: `# Raspberry Pi Zero 2 W Compact Security Camera
board RPI_ZERO_CAM "Raspberry Pi Zero 2 W" {
  SOC "RP3A0 (SiP SoC)" {
    width: 200px
    height: 150px
    color: #FEF3C7
  }

  USB_PWR "Micro-USB Power" @ edge.top
  USB_PWR -> SOC.top : power(5V 2.5A)

  # Bottom: I2C ambient light sensor
  SOC.bottom -> LIGHT_SENSOR "BH1750 (Ambient Light)" .top : i2c(addr: 0x23)

  # Right: WS2812B NeoPixel 8-LED ring (auxiliary lighting)
  SOC.right -> NEO_RING "WS2812B 8-LED Ring" .left : gpio(GPIO 18 / PWM) [note: "DIN 470Ω Protection"]
}

CAM_MOD "RPi Camera Module 3" {
  width: 170px
  height: 120px
}
RPI_ZERO_CAM.SOC.left ---> CAM_MOD.right : diff("CSI-2 2-Lane MIPI") via connector("15-pin FPC 0.5mm")`
        },

        nanoDataLogger: {
            title: 'Arduino Nano Field Data Logger (SPI MicroSD & DS3231 RTC)',
            code: `# Arduino Nano Field Data Logger
board NANO_LOGGER "Field Data Logger Shield" {
  MCU "Arduino Nano (ATmega328P)" {
    width: 230px
    height: 160px
    color: #E0F2FE
  }

  EXT_BAT "9V 006P Battery" @ edge.top
  EXT_BAT -> MCU.top : power(VIN 9V)

  # Left: Analog sensor & I2C high-precision RTC
  CDS_DIVIDER "CdS Photoresistor" .right -> MCU.left : analog(A0: 10kΩ Divider)
  MCU.left -> RTC_DS3231 "DS3231 High-Precision RTC" .right : i2c(addr: 0x68, 32kHz TCXO)

  # Right: SPI High-Speed MicroSD Card Slot
  MCU.right -> SD_MODULE "MicroSD Card Slot" @ edge : spi(CS: D4, MOSI: D11, MISO: D12, SCK: D13)

  warning for SD_MODULE.bottom "SD card operates at 3.3V (Level shifter required)"
}`
        },

        picoPanTilt: {
            title: 'Raspberry Pi Pico 2-Axis Pan-Tilt Mount (PCA9685 & SG90 Servos)',
            code: `# Raspberry Pi Pico 2-Axis Pan-Tilt Servo Control
board PICO_ROBOTICS "Pico Servo Controller" {
  MCU "RP2040" {
    width: 220px
    height: 160px
    color: #FCE7F3
  }

  # Left: 2-axis analog joystick input
  JOYSTICK "2-Axis Analog Joystick" .right -> MCU.left : analog(X: GP26/ADC0, Y: GP27/ADC1)

  # Right: I2C 16ch PWM controller
  MCU.right -> PWM_DRIVER "PCA9685 16ch PWM" .left : i2c(addr: 0x40, 12-bit)
}

# External servo power supply (protects MCU from servo inrush current)
SERVO_BAT "External 5V 3A UBEC" -> PICO_ROBOTICS.PWM_DRIVER.top : power(5V V+ Servo Rail)

SERVO_PAN  "SG90 Micro Servo (Pan / X)"
SERVO_TILT "SG90 Micro Servo (Tilt / Y)"
PICO_ROBOTICS.PWM_DRIVER.right --> SERVO_PAN.left  : pwm(CH0: 50Hz Pulse)
PICO_ROBOTICS.PWM_DRIVER.right --> SERVO_TILT.left : pwm(CH1: 50Hz Pulse)`
        },

        proMiniLora: {
            title: 'Arduino Pro Mini Solar-Powered LoRa Node (SX1278 & BME680)',
            code: `# Arduino Pro Mini Solar-Powered LoRa Remote Node
board LORA_NODE "LoRa Low-Power Sensor PCB" {
  MCU "ATmega328P (3.3V 8MHz)" {
    width: 230px
    height: 160px
    color: #ECFDF5
    note: "Sleep Current < 5µA (LED / Regulator Removed)"
  }

  SOLAR_CELL "Solar Panel (5V 1W)" @ edge.top
  SOLAR_CELL -> CHG_CTRL "CN3065 Solar Charger" : power(5V Solar)
  CHG_CTRL -> LIFEPO4 "LiFePO4 3.2V Cell" : power(3.6V Charge)
  LIFEPO4 -> MCU.top : power(3.2V Direct VBAT)

  # Left: I2C Environmental Sensor (Temp/Humidity/Pressure/VOC Gas)
  MCU.left -> BME680 "BME680 Gas & Weather" .right : i2c(addr: 0x77)

  # Right: SPI Long-Range LoRa Wireless Module
  MCU.right -> LORA_RFM "SX1278 / RFM95W LoRa" @ edge : spi(CS: D10, DIO0: D2) [note: "920MHz Band / Long-Range"]
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
