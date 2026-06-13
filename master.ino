#include <SPI.h>
#include <nRF24L01.h>
#include <RF24.h>

RF24 radio(9, 10);
const byte address[6] = "00001";

struct N1Data {
  int id;
  float temp;
  float vib;
  float rpm;
};

struct N2Data {
  int id;
  float temp;
  float humidity;
  float flow;
};

N1Data n1 = {1, 0, 0, 0};
N2Data n2 = {2, 0, 0, 0};

bool n1_received = false;
bool n2_received = false;

unsigned long lastPrint = 0;
int sampleCount = 0;

// Running averages
float avg_temp1 = 0, avg_vib = 0, avg_rpm = 0;
float avg_temp2 = 0, avg_humidity = 0, avg_flow = 0;

float alpha = 0.02;
float threshold = 0.2;

void setup() {
  Serial.begin(250000);

  radio.begin();
  radio.setDataRate(RF24_250KBPS);
  radio.openReadingPipe(0, address);
  radio.setPALevel(RF24_PA_LOW);
  radio.startListening();

  Serial.println("N1_id,N1_temp,N1_vib,N1_rpm,N2_id,N2_temp,N2_humidity,N2_flow,risk");
}

void loop() {

  // 📡 RECEIVE DATA
  while (radio.available()) {
    byte buffer[32];
    radio.read(&buffer, sizeof(buffer));

    int id = ((int*)buffer)[0];

    if (id == 1) {
      memcpy(&n1, buffer, sizeof(N1Data));
      n1_received = true;
    } 
    else if (id == 2) {
      memcpy(&n2, buffer, sizeof(N2Data));
      n2_received = true;
    }
  }

  // ⏱️ PRINT EVERY 10ms (ALWAYS)
  if (millis() - lastPrint >= 1000 && sampleCount < 5000) {

    lastPrint = millis();

    // Update averages ONLY if data available
    if (n1_received) {
      avg_temp1 = (1 - alpha) * avg_temp1 + alpha * n1.temp;
      avg_vib   = (1 - alpha) * avg_vib   + alpha * n1.vib;
      avg_rpm   = (1 - alpha) * avg_rpm   + alpha * n1.rpm;
    }

    if (n2_received) {
      avg_temp2 = (1 - alpha) * avg_temp2 + alpha * n2.temp;
      avg_humidity = (1 - alpha) * avg_humidity + alpha * n2.humidity;
      avg_flow  = (1 - alpha) * avg_flow  + alpha * n2.flow;
    }

    int risk = 0;

    // ✅ Warm-up phase
    if (sampleCount > 100) {

      // ✅ Add base thresholds (prevents avg≈0 issue)
      if (n1.temp > max(30.0, avg_temp1 * (1 + threshold))) risk = 1;
      if (n1.vib  > max(50.0, avg_vib   * (1 + threshold))) risk = 1;

      // RPM logic
      if (n1.rpm > max(100.0, avg_rpm * 1.5)) risk = 1;
      if (n1.rpm < avg_rpm * 0.5 && avg_rpm > 50) risk = 1;

      if (n2.temp > max(30.0, avg_temp2 * (1 + threshold))) risk = 1;
      if (n2.humidity > max(40.0, avg_humidity * (1 + threshold))) risk = 1;
      if (n2.flow > max(2.0, avg_flow * (1 + threshold))) risk = 1;
    }

    // 📤 ALWAYS PRINT (even if one node delayed)
    Serial.print(n1.id); Serial.print(",");
    Serial.print(n1.temp); Serial.print(",");
    Serial.print(n1.vib); Serial.print(",");
    Serial.print(n1.rpm); Serial.print(",");

    Serial.print(n2.id); Serial.print(",");
    Serial.print(n2.temp); Serial.print(",");
    Serial.print(n2.humidity); Serial.print(",");
    Serial.print(n2.flow); Serial.print(",");

    Serial.println(risk);

    sampleCount++;   // ✅ ALWAYS increments now
  }

  // 🛑 STOP EXACTLY AT 5000
  if (sampleCount >= 5000) {
    Serial.println("DONE");
    while (1);
  }
}
