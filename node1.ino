#include <SPI.h>
#include <nRF24L01.h>
#include <RF24.h>
#include <OneWire.h>
#include <DallasTemperature.h>

RF24 radio(9, 10);
const byte address[6] = "00001";

#define ONE_WIRE_BUS 3

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

struct N1Data {
  int id;
  float temp;
  float vib;
  float rpm;
};

N1Data data;

// Pins
int hallPin = A0;
int vibPin  = A2;

// RPM variables
int lastHallState = 0;
int pulseCount = 0;

unsigned long lastRPMTime = 0;
float rpm = 0;

int threshold = 500;
int magnets = 1;

// 🔥 VIBRATION VARIABLES
float vib_baseline = 0;
bool vib_calibrated = false;
unsigned long calibStart = 0;
int calibSamples = 0;

void setup() {
  Serial.begin(115200);

  pinMode(hallPin, INPUT);

  tempSensor.begin();

  radio.begin();
  radio.setDataRate(RF24_250KBPS);
  radio.openWritingPipe(address);
  radio.setPALevel(RF24_PA_LOW);
  radio.stopListening();

  data.id = 1;

  calibStart = millis();   // start calibration timer
}

void loop() {

  // ===== TEMPERATURE =====
  tempSensor.requestTemperatures();
  data.temp = 26 + (random(1,5));   // (kept as you had)

  // ===== VIBRATION (FINAL FIX) =====
  int rawVib = analogRead(vibPin)-150;

  // --- Calibration phase (first 2 sec) ---
  if (!vib_calibrated) {
    vib_baseline += rawVib;
    calibSamples++;

    if (millis() - calibStart > 2000) {
      vib_baseline = vib_baseline / calibSamples;
      vib_calibrated = true;
    }

    data.vib = 0;   // no output during calibration
  }
  else {
    data.vib = abs(rawVib - vib_baseline);

    // remove small noise
    if (data.vib < 5) data.vib = 0;
  }

  // ===== RPM =====
  int hallValue = analogRead(hallPin);
  int currentState = (hallValue > threshold) ? 1 : 0;

  if (currentState == 1 && lastHallState == 0) {
    pulseCount++;
  }

  lastHallState = currentState;

  if (millis() - lastRPMTime >= 1000) {
    rpm = (pulseCount * 60.0) / magnets;
    data.rpm = rpm;

    pulseCount = 0;
    lastRPMTime = millis();
  }

  // ===== SEND =====
  radio.write(&data, sizeof(data));

  // ===== DEBUG =====
  Serial.print("Temp: "); Serial.print(data.temp);
  Serial.print(" C  Vib: "); Serial.print(data.vib);
  Serial.print(" RPM: "); Serial.println(data.rpm);

  delay(10);
}
