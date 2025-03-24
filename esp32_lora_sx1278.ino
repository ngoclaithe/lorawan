#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <BH1750.h>

#define ss 5
#define rst 14
#define dio0 2
#define LED1 27
#define LED2 26
#define LED3 12
#define PIR_PIN 13  

byte msgCount = 0;
byte localAddress = 0xFF;
byte destination = 0xBB;

BH1750 lightMeter;
bool autoMode = false; 
uint16_t lux_threshold = 50; 

unsigned long lastSendTime = 0;
int sendInterval = 5000; 

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("ESP32 LoRa Receiver");

  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);
  pinMode(LED3, OUTPUT);
  digitalWrite(LED1, LOW);
  digitalWrite(LED2, LOW);
  digitalWrite(LED3, LOW);
  
  Wire.begin();
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("BH1750 initialized.");
  } else {
    Serial.println("Error initializing BH1750");
  }
  
  pinMode(PIR_PIN, INPUT);

  LoRa.setPins(ss, rst, dio0);
  if (!LoRa.begin(433E6)) {
    Serial.println("Starting LoRa failed!");
    delay(100);
    while (1);
  }
  
  Serial.println("LoRa Initializing OK!");
}

void loop() {
  uint16_t lux = lightMeter.readLightLevel();
  int pirValue = digitalRead(PIR_PIN);

  if (autoMode) {
    Serial.print("Lux: ");
    Serial.print(lux);
    Serial.print(" | PIR: ");
    Serial.println(pirValue);
    Serial.print("Threshold: ");
    Serial.println(lux_threshold);
    
    if (lux > lux_threshold && pirValue == LOW) {
      Serial.println("Tắt đèn");
      digitalWrite(LED1, LOW);
      digitalWrite(LED2, LOW);
      digitalWrite(LED3, LOW);
    } else {
      Serial.println("Bật đèn");
      digitalWrite(LED1, HIGH);
      digitalWrite(LED2, HIGH);
      digitalWrite(LED3, HIGH);
    }
  }
  
  if (millis() - lastSendTime >= sendInterval) {
    String sensorStatus = getFullStatus(lux, pirValue);
    sendMessage(sensorStatus);
    Serial.println("Sending status: " + sensorStatus);
    lastSendTime = millis();
  }
  
  onReceive(LoRa.parsePacket());
}

void sendMessage(String outgoing) {
  LoRa.beginPacket();
  LoRa.write(destination);       
  LoRa.write(localAddress);      
  LoRa.write(msgCount);          
  LoRa.write(outgoing.length()); 
  LoRa.print(outgoing);          
  LoRa.endPacket();
  msgCount++;
}

String getFullStatus(uint16_t lux, int pirValue) {
  String status = "";
  status += "led1:" + String(digitalRead(LED1) == HIGH ? "on" : "off") + ",";
  status += "led2:" + String(digitalRead(LED2) == HIGH ? "on" : "off") + ",";
  status += "led3:" + String(digitalRead(LED3) == HIGH ? "on" : "off") + ",";
  status += "pir:" + String(pirValue) + ",";
  status += "lux:" + String(lux) + ",";
  status += "threshold:" + String(lux_threshold) + ",";
  status += "mode:" + String(autoMode ? "1" : "0") + ",";
  status += "rssi:" + String(LoRa.packetRssi());
  
  return status;
}

void onReceive(int packetSize) {
  if (packetSize == 0) return; 

  int recipient = LoRa.read();
  byte sender = LoRa.read();
  byte incomingMsgId = LoRa.read();
  byte incomingLength = LoRa.read();
  
  if (recipient != localAddress && recipient != 0xFF) {
    Serial.println("This message is not for me.");
    return;
  }
  
  Serial.println("Received message:");
  Serial.print("From: 0x"); Serial.println(sender, HEX);
  Serial.print("To: 0x"); Serial.println(recipient, HEX);
  Serial.print("Message ID: "); Serial.println(incomingMsgId);
  Serial.print("Message length: "); Serial.println(incomingLength);
  Serial.print("RSSI: "); Serial.println(LoRa.packetRssi());
  Serial.print("Snr: "); Serial.println(LoRa.packetSnr());
  
  String receivedData = "";
  while (LoRa.available()) {
    receivedData += (char)LoRa.read();
  }
  
  Serial.println("Data: " + receivedData);
  processCommand(receivedData);
}

void processCommand(String data) {
  
  int startPos = 0;
  int commaPos = data.indexOf(',');
  
  while (commaPos >= 0 || startPos < data.length()) {
    String segment;
    
    if (commaPos >= 0) {
      segment = data.substring(startPos, commaPos);
      startPos = commaPos + 1;
      commaPos = data.indexOf(',', startPos);
    } else {
      segment = data.substring(startPos);
      startPos = data.length();
    }
    
    processSegment(segment);
  }
}

void processSegment(String segment) {
  int colonPos = segment.indexOf(':');
  if (colonPos < 0) return;
  
  String key = segment.substring(0, colonPos);
  String value = segment.substring(colonPos + 1);
  
  Serial.print("Processing: "); 
  Serial.print(key); 
  Serial.print("="); 
  Serial.println(value);
  
  if (key == "mode") {
    autoMode = (value == "1");
    Serial.print("Auto mode: ");
    Serial.println(autoMode ? "enabled" : "disabled");
  } 
  else if (key == "threshold" || key == "lux") {
    // Accept threshold updates regardless of mode
    lux_threshold = value.toInt();
    Serial.print("Lux threshold set to: ");
    Serial.println(lux_threshold);
  }
  else if (key == "led1" && !autoMode) {
    digitalWrite(LED1, (value == "on") ? HIGH : LOW);
  }
  else if (key == "led2" && !autoMode) {
    digitalWrite(LED2, (value == "on") ? HIGH : LOW);
  }
  else if (key == "led3" && !autoMode) {
    digitalWrite(LED3, (value == "on") ? HIGH : LOW);
  }
}