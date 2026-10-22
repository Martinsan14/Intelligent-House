# Hardware recommendations

Buy switching equipment only after an electrician has checked supply voltage, number of phases, circuit layout, LED-driver inrush, enclosure space, neutral availability and wall-switch wiring. Eighteen bulbs are not necessarily eighteen separately wired controllable circuits. A relay's printed resistive rating is not its LED-lighting rating.

## Recommended installed-house approach

Prefer certified smart relay modules with dedicated physical-switch inputs, documented local control and appropriate LED load ratings. Examples to evaluate are **Shelly Pro 4PM** for compatible DIN-rail, single-phase lighting circuits (five units offer twenty channels), or **Shelly Plus 1 / Shelly 1 Gen3** for suitably wired individual circuits. These are product families to assess, not a guarantee of suitability; ratings, neutral requirements and regional certification must be checked for your exact model.

These products already contain controllers. They can simplify installation and preserve wall-switch input behavior, but **they are not a drop-in match for the included MCP23017 firmware**: they need their own MQTT/API adapter, switch mode and feedback configuration. Using them may make the ESP32 unnecessary for the lighting circuits. Do not order five multi-channel modules until the electrician confirms your circuit topology.

## If you specifically want to use your ESP32

The included reference firmware targets a low-voltage prototype with:

- Your ESP32 DevKitC ESP32-WROOM-32, CP2102, micro USB data cable.
- Four **MCP23017 3.3 V-compatible I²C expander boards**, each with independently selectable addresses, configured as documented in README.
- Eighteen **active-high**, 3.3 V-compatible, properly isolated output driver channels. Driver modules and installed switching devices must be professionally selected together; hobby relay boards are not recommended for household mains distribution.
- Eighteen isolated dry-contact input channels or approved isolation interfaces for existing switches. Existing mains switch wiring cannot be reused as logic wiring without an electrician's redesign and isolation assessment.
- A certified isolated low-voltage power supply, proper enclosure, terminals, protection and strain relief. Power budgeting and coil suppression are part of the hardware design.

Prototype with low-voltage indicator loads first. For permanent installation, prefer a professionally assembled controller with certified input/output modules and manual override. A single MCU is a single point of failure; this firmware alone does not guarantee wall-switch operation if it fails.

## Whole-house power

Use an electrician-selected **contactor**, sized for your service, phase count, utilization category and load/inrush, with a suitable protected coil driver, auxiliary contact feedback and manual override. Brands such as Schneider Electric, ABB and Eaton offer suitable product families; no exact model can be selected without service specifications. Do not use a hobby relay or switch protective earth. Required protective devices and essential loads must be addressed in the design.

Keep the controller, contactor control supply, router, internet modem/ONT and any local server on an appropriate protected, always-powered supply/UPS upstream of the switched loads. Otherwise remote restoration may be impossible. Decide explicitly whether a control-power failure leaves the house energized or de-energized; emergency access and local override need a professional design.

The website contains a confirmation flow, but the firmware deliberately has **no whole-house output**. Implementing the monitored adapter and testing the actual contactor is still required before enabling it. A network command must never substitute for a safety disconnect or lockout procedure.
