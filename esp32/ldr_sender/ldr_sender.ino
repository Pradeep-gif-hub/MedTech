#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* DATABASE_URL = "health-monitor-5ad13-default-rtdb.firebaseio.com";
const char* USER_ID = "YOUR_USER_ID"; // must match frontend localStorage.getItem('user_id')
const int LDR_PIN = 36; // ADC1 channel, e.g. GPIO36

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 5000; // send every 5 seconds

void setup() {
  Serial.begin(115200);
  pinMode(LDR_PIN, INPUT);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");
}

void sendToFirebase(int ldrValue) {
  WiFiClientSecure client;
  client.setInsecure(); // for testing only

  HTTPClient https;
  String url = String("https://") + DATABASE_URL + "/telemetry/" + USER_ID + "/ldr.json";
  https.begin(client, url);
  https.addHeader("Content-Type", "application/json");
  String payload = String(ldrValue);
  int code = https.PUT(payload); // overwrite with latest value
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
  int ldrValue = analogRead(LDR_PIN); // 0-4095
  Serial.printf("LDR: %d\n", ldrValue);
  sendToFirebase(ldrValue);
}
