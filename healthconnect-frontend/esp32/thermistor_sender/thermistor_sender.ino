#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASS = "YOUR_PASSWORD";

// Firebase Realtime Database root URL, e.g. "yourproject.firebaseio.com"
const char* DATABASE_URL = "YOUR_PROJECT.firebaseio.com"; // no https://, no trailing slash
// If you have a database secret or auth token for REST writes, put it here (or remove ?auth param if using public)
const char* DATABASE_AUTH = "YOUR_DB_SECRET_OR_AUTH_TOKEN"; // optional

const int THERMISTOR_PIN = 34; // ADC pin (one of ADC1 pins)
const unsigned long SEND_INTERVAL_MS = 5000;

unsigned long lastSend = 0;

float readThermistor() {
  // Simple raw reading -> pseudo temperature conversion.
  // Replace with proper Steinhart-Hart conversion per your thermistor/resistor values.
  int raw = analogRead(THERMISTOR_PIN);
  float voltage = (raw / 4095.0) * 3.3; // 12-bit ADC
  // crude mapping - calibrate for your sensor
  float tempC = (voltage - 0.5) * 100.0; // example for TMP36 style; adjust for thermistor
  float tempF = tempC * 9.0 / 5.0 + 32.0;
  return tempF;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  pinMode(THERMISTOR_PIN, INPUT);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");
}

void sendToFirebase(float temp) {
  WiFiClientSecure client;
  client.setInsecure(); // for testing only; replace with cert validation in prod

  HTTPClient https;
  String url = String("https://") + DATABASE_URL + "/telemetry/" + String("PATIENT_ID") + "/thermistor.json";
  // If you want to store timestamped nodes:
  // String url = String("https://") + DATABASE_URL + "/telemetry/" + String("PATIENT_ID") + "/thermistor/" + String(millis()) + ".json";

  if (strlen(DATABASE_AUTH) > 0) {
    url += "?auth=" + String(DATABASE_AUTH);
  }

  https.begin(client, url);
  https.addHeader("Content-Type", "application/json");
  String payload = String(temp, 2); // numeric payload
  int code = https.PUT(payload); // will replace the value at thermistor path
  if (code > 0) {
    Serial.printf("Firebase response: %d\n", code);
    Serial.println(https.getString());
  } else {
    Serial.printf("Error sending: %s\n", https.errorToString(code).c_str());
  }
  https.end();
}

void loop() {
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();
  float tempF = readThermistor();
  Serial.printf("Temp: %.2f F\n", tempF);
  sendToFirebase(tempF);
}
