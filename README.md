# Haven · Intelligent House

A phone-friendly website for 18 lights, with an ESP32-WROOM-32 DevKitC firmware framework. Includes room filters, all-on/all-off, sign-in for live control, offline detection, expiring commands, device acknowledgements, and a guarded whole-house panel.

**Current delivery:** functional simulation and live MQTT integration framework. Not deployed; physical lights and remote access have not been commissioned. The main-power panel stays locked with the supplied firmware. See [hardware recommendations](docs/HARDWARE.md).

## Try it in VS Code

Install Node.js 24 LTS, open this folder, and use the terminal:

```sh
npm ci
npm start
```

Open the local address shown by your development setup on port 3000. The default server binds to `127.0.0.1`. No password or electrical hardware is needed for demo mode. All device states are simulated and reset when the server restarts. To test from a phone on trusted home Wi-Fi, run with `HOST=0.0.0.0` (or set it in `.env`) and use the computer's LAN address. Do not forward router ports.

Rename any light using the pencil button on its card, enter a name, then choose **Save name**. Names support up to 40 characters and are shared by all devices. They survive server restarts in `data/light-names.json` (ignored by Git). Back up this file and keep the data directory on persistent storage when hosting; set `LIGHT_NAMES_FILE` to override its location. Renaming works while the controller is offline and never switches a light. Live mode requires sign-in to rename. Room assignments are currently configured in `server.js`. The UI reports controller output state, not measured lamp power. A failed bulb, welded contact, or breaker trip cannot be detected by this reference adapter.

## Live control at home and away

Recommended path: run the website on an always-on computer/Raspberry Pi at home, use a private VPN such as Tailscale on that computer and your phone, and use its HTTPS serving feature. The ESP32 and server connect outward to an authenticated TLS MQTT broker. Internet access at home is necessary for this broker-based reference design. Physical switch handling is local to the ESP32.

1. Copy `.env.example` to `.env`. Keep credentials private. Set `CONTROL_MODE=mqtt`, a long unique `ADMIN_PASSWORD`, and a random `SESSION_SECRET` of at least 32 characters. Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. Provision an MQTT broker with a trusted TLS certificate on port 8883. Fill in `MQTT_URL`, username and password. Use separate server/device accounts with topic ACLs as described below. Do not enable anonymous access. Keep broker credentials outside Git.
3. Configure and upload the firmware below. Confirm the low-voltage adapter and switching hardware before enabling it.
4. Start the website with `npm start`. Expose it only through the authenticated private VPN and HTTPS; keep the Node listener on loopback. Set `SECURE_COOKIES=true` behind that trusted HTTPS proxy. The server trusts one proxy hop in this mode, so do not expose the underlying listener. On the phone, connect to your VPN and use the private HTTPS hostname from both home and away.
5. Confirm login, switch commands, physical wall switch events, device unplug/offline behavior, and reconnection before connecting real loads.

No external service or account has been provisioned by this project. Broker, VPN, hosting and installation are deployment prerequisites. Sessions are in process memory and expire on restart; suitable for one household server process. Use a persistent session store and stronger identity controls before a broader multiuser/public deployment.

### MQTT contract

Use a unique `MQTT_HOME_ID` / firmware `HOME_ID`, letters/digits/hyphens only. Topic prefix: `house/<home-id>`.

- Server account may publish `/command` and subscribe `/state` only.
- Device account may subscribe `/command` and publish `/state` only.
- Commands must **never be retained**. Clean sessions prevent offline command replay. If replacing an existing installation, clear any retained commands before commissioning.
- Command: `{"id":"unique-id","target":1,"on":true,"expires":1790000000}`. `target` is 1–18 or `"all"`; expiry is Unix seconds, ten seconds after issue.
- State heartbeat every 15 seconds: `{"online":true,"lights":[false, ... eighteen booleans],"main":null,"ack":"command-id"}`. Last will is `{"online":false}`. State is non-retained. Server treats state as offline after 45 seconds and requires acknowledgement within five seconds.
- Main control is an extension point (`target: "main"`), deliberately rejected by the supplied firmware. Do not set `ENABLE_MAIN_POWER=true` until a professionally commissioned, monitored contactor adapter is implemented and tested. An HTTP timeout does not establish whether a switching operation happened; inspect actual state before retrying.

### ESP32 and PlatformIO

1. Install the PlatformIO extension in VS Code. Open `firmware` as its project folder.
2. Copy `firmware/include/secrets.example.h` to `secrets.h` in that directory. Fill in Wi-Fi, dedicated MQTT device credentials, home ID, and the broker's authentic root CA certificate. TLS verification is mandatory. ESP32-WROOM-32 uses 2.4 GHz Wi-Fi.
3. Build with `pio run` from `firmware`. Connect the DevKitC using a data-capable micro USB cable, then `pio run --target upload` and `pio device monitor`. Install a CP210x driver from Silicon Labs if your OS needs it.
4. Firmware defaults to hardware locked. The placeholder secrets allow compilation, not broker connectivity. Hardware commissioning is an independent physical step.

The reference adapter uses four MCP23017 devices: output expanders 0x20/0x21 and input expanders 0x22/0x23, on GPIO21 SDA / GPIO22 SCL. Channels 1–16 use the first chip and 17–18 the second. Only dry, isolated low-voltage switch contacts are supported. **Never connect existing mains wall-switch wires directly to an ESP32 or expander.** Output drivers must be active-high and boot-safe; arbitrary relay boards are not interchangeable. GPIO expansion pins cannot drive relay coils directly. Outputs start OFF after restart; each debounced physical switch edge toggles the output, so the wall switch position is not an absolute indication of on/off. Physical switch operation survives Wi-Fi loss but depends on MCU and power health; use independent/manual switching hardware if outage resilience is required. No firmware update or first boot should be attempted on live loads without checking this restart behavior.

## Validation

```sh
npm test
npx playwright install chromium
npm run test:browser
```

A preinstalled Chromium can be selected with `CHROMIUM_PATH=/path/to/chromium npm run test:browser`. API tests cover individual/group controls, validation, locked house power, origin protection, login/logout and offline rejection. Browser tests exercise the mobile layout and controls. They do not establish electrical safety or physical hardware compatibility. Build firmware separately with `pio run -d firmware`.
