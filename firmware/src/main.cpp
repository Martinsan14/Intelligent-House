#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Adafruit_MCP23X17.h>
#include <time.h>
#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif
// Reference LOW-VOLTAGE adapter only: 2 output and 2 switch-input expanders.
// Outputs are active-high, boot OFF. Do not connect an active-low relay module.
// GPIO21 SDA / GPIO22 SCL. Switch inputs use dry contacts to logic ground.
// Mains wiring, contactor drivers and isolation require professional design.
Adafruit_MCP23X17 outputs[2], inputs[2];
WiFiClientSecure tls;
PubSubClient client(tls);
bool lights[18] = {}, rawSwitch[18] = {}, stableSwitch[18] = {};
unsigned long changed[18] = {}, lastPublish=0, lastConnect=0;
String base=String("house/")+HOME_ID;
String lastCommand;
bool ready=false;
void publishState(const char* ack=nullptr){
 JsonDocument doc; doc["online"]=ready;
 auto array=doc["lights"].to<JsonArray>(); for(bool light:lights)array.add(light);
 // Main contactor is intentionally unsupported until a monitored adapter exists.
 doc["main"]=nullptr; if(ack)doc["ack"]=ack;
 char buffer[768];serializeJson(doc,buffer,sizeof(buffer));
 client.publish((base+"/state").c_str(),buffer,false);lastPublish=millis();
}
void setLight(int i,bool on){outputs[i/16].digitalWrite(i%16,on?HIGH:LOW);lights[i]=on;}
void command(char*,byte* payload,unsigned int length){
 if(!ready||length>512)return;
 JsonDocument doc;if(deserializeJson(doc,payload,length))return;
 if(!doc["id"].is<const char*>()||!doc["on"].is<bool>()||!doc["expires"].is<long>())return;
 long now=time(nullptr),expires=doc["expires"];
 if(now<1700000000||expires<now||expires>now+15)return;
 String id=doc["id"].as<String>();if(id.length()>64)return;
 if(id==lastCommand){publishState(id.c_str());return;}
 bool on=doc["on"];
 if(doc["target"].is<int>()){
  int target=doc["target"];if(target<1||target>18)return;setLight(target-1,on);
 }else if(doc["target"].is<const char*>()&&String(doc["target"].as<const char*>())=="all"){
  for(int i=0;i<18;i++)setLight(i,on);
 }else return;
 lastCommand=id;publishState(id.c_str());
}
void setup(){
 Serial.begin(115200);Wire.begin(21,22);
 if(HARDWARE_COMMISSIONED){
  ready=true;
  for(int i=0;i<2;i++){
   if(!outputs[i].begin_I2C(0x20+i)||!inputs[i].begin_I2C(0x22+i)){ready=false;break;}
  }
  if(ready)for(int i=0;i<18;i++){
   outputs[i/16].digitalWrite(i%16,LOW);outputs[i/16].pinMode(i%16,OUTPUT);
   inputs[i/16].pinMode(i%16,INPUT_PULLUP);
   rawSwitch[i]=stableSwitch[i]=inputs[i/16].digitalRead(i%16);
  }
 }
 Serial.println(ready?"Low-voltage adapter enabled":"Hardware locked; configure and commission adapter first");
 WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
 configTime(0,0,"pool.ntp.org","time.nist.gov");
 tls.setCACert(MQTT_ROOT_CA);client.setServer(MQTT_HOST,MQTT_PORT);client.setCallback(command);client.setBufferSize(1024);client.setSocketTimeout(3);
}
void loop(){
 unsigned long now=millis();
 if(WiFi.status()==WL_CONNECTED&&!client.connected()&&now-lastConnect>5000){
  lastConnect=now;
  String id="haven-"+String((uint32_t)ESP.getEfuseMac(),HEX);
  if(time(nullptr)>1700000000&&client.connect(id.c_str(),MQTT_USER,MQTT_PASSWORD,(base+"/state").c_str(),1,false,"{\"online\":false}")){
   client.subscribe((base+"/command").c_str(),1);publishState();
  }
 }
 client.loop();
 // Physical switches continue working without Wi-Fi while MCU/adapter are healthy.
 // A mechanical switch toggles the current output on either stable edge.
 if(ready)for(int i=0;i<18;i++){
  bool value=inputs[i/16].digitalRead(i%16);
  if(value!=rawSwitch[i]){rawSwitch[i]=value;changed[i]=now;}
  if(value!=stableSwitch[i]&&now-changed[i]>=50){stableSwitch[i]=value;setLight(i,!lights[i]);if(client.connected())publishState();}
 }
 if(client.connected()&&now-lastPublish>15000)publishState();
 delay(5);
}
