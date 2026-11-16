# CamControl — ad-free app for the V720 mini Wi-Fi camera, with a speed radar

Controls the small clip-on "WiFi" cameras that use the **V720** app (Naxclow chipset, hotspot at `192.168.169.1`). No ads, no account, no cloud. It runs in the browser on your **iPhone/Android** and your **MacBook**, and can be installed to the home screen.

| | |
|---|---|
| Live view | Low-latency picture, digital zoom and pan, rotate/mirror, full screen |
| Camera controls | Night vision (IR) on/off, camera image flip/mirror, restart camera |
| Save | Photos (JPEG) and videos (MP4/WebM, with sound when Listen is on) straight to your device |
| Listen | The camera's microphone |
| SD card | List the camera's recordings by day and download any minute as AVI |
| **Speed radar** | Two lines A and B with a known distance between them; detects moving objects and calculates **v = d / t**, shows the result with its ± range, direction, photo of each pass, alert above a limit, CSV export |
| Stopwatch | Manual v = d / t when there's no camera |
| Other sources | The radar also works with your phone/Mac camera or a video file (slow-motion playback for precision) |

## iPhone app

There is also a real **iPhone app** in [`ios/`](ios/README.md). It connects straight to the camera with no MacBook in between. You install it once from your Mac with Xcode (free); see [ios/README.md](ios/README.md).

## How it works (browser version)

A browser can't talk to the camera directly (it uses its own binary protocol over TCP port 6123), so a small **bridge** runs on your Mac. The Mac joins the camera's Wi-Fi, the bridge talks to the camera and serves the app; your phone opens the app from the Mac.

```
 Camera ──Wi-Fi (its own hotspot)──► MacBook: node server.js ──► Mac browser
                                                    └──────────► Phone browser (same Wi-Fi)
```

## Start it (MacBook)

1. Install **Node.js** (LTS) from <https://nodejs.org> once. Nothing else needs installing.
2. Try it without the camera first: in Terminal, `cd` into this `camera` folder and run
   `node server.js --demo`, then open <http://localhost:8720>. The demo road has posts 10 m apart and cars at 36 and 54 km/h, so you can see the radar working. Open the **Radar** tab and switch it on.
3. With the camera: switch it on. If it was paired with the V720 app before, hold the button on the side for **5 seconds** until the blue light blinks fast (back to hotspot mode).
4. On the Mac, join the camera's Wi-Fi (the name usually starts with `Nax_` or `MC-`; it has no internet, which is fine).
5. Double-click **`start-mac.command`** (or run `node server.js`). The app opens in the browser.
6. **Phone:** join the same camera Wi-Fi, then open the "On your phone" address the Mac prints (for example `http://192.168.169.2:8720`). iPhone: Share → **Add to Home Screen**.

Options: `--port 8720`, `--camera 192.168.169.1:6123`, `--password YOURPASS` (asks for it on every device), `--local-only` (only this Mac).
Keys on the Mac: `P` photo, `R` record, `F` full screen, `Space` stopwatch (in the Radar tab).

## Using the radar well

- Film the path **from the side**. Put line **A** and line **B** exactly on two marks on the ground whose distance you measured (tape measure, tiles, road dashes). Enter that distance.
- Further apart is more accurate: the camera sends 10–20 frames per second, so each crossing is known to about one frame. The app shows this as a range (e.g. 48–52 km/h).
- Lower the sensitivity if trees, shadows or rain trigger it; raise it for small or dark objects. "Show detected motion" paints what the detector sees.
- Turning night vision on/off changes the whole picture; the radar re-learns the scene instead of measuring.
- This is a hobby and learning tool, not a certified speed-enforcement device.

## Limits worth knowing

- **Range** is the camera's own Wi-Fi range (roughly 10–30 m). For control from anywhere, keep the Mac near the camera with internet from a cable or second adapter and use a VPN like Tailscale to reach the Mac.
- The camera's **home Wi-Fi (STA) mode** sends video to the manufacturer's cloud instead of to your network, so this app uses hotspot mode.
- The protocol was reverse-engineered by the community ([a9-v720](https://github.com/intx82/a9-v720)) on one firmware. Live view, IR and flip are the best tested; SD-card download may differ on some firmwares. If something doesn't respond, the **Setup** tab shows the last error.
- The phone/Mac camera as a source needs `https` or `localhost` (browser rule), so on the phone use the Wi-Fi camera or a video file.

## Files

| Path | What |
|---|---|
| `server.js` | Bridge + web server (Node built-ins only) |
| `bridge/protocol.js` | Packet format, JPEG re-assembly, SD-card catalogue parsing |
| `bridge/camera.js` | Connection, reconnects, commands, streams only while someone watches (saves battery) |
| `bridge/simulator.js` | A fake camera with the same protocol, for `--demo` and tests |
| `public/` | The app (`app.js`), radar maths and detector (`radar.js`) |
| `ios/` | The iPhone app (Swift); it reuses `public/` for its screens |
| `test/` | `npm test` (or `node --test test/*.test.js`) |
