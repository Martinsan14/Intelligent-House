#pragma once
// Copy to secrets.h. Never commit credentials. Use a dedicated device account.
#define WIFI_SSID "YOUR_WIFI"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define MQTT_HOST "YOUR_BROKER_HOST"
#define MQTT_PORT 8883
#define MQTT_USER "YOUR_DEVICE_USER"
#define MQTT_PASSWORD "YOUR_DEVICE_PASSWORD"
#define HOME_ID "my-house"
// Paste the broker's verified root CA PEM here. Never use setInsecure().
static const char MQTT_ROOT_CA[] = R"PEM(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_BROKER_ROOT_CA
-----END CERTIFICATE-----
)PEM";
// Keep false until the low-voltage adapter has been commissioned by an expert.
#define HARDWARE_COMMISSIONED false
