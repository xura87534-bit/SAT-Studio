# CamControl for iPhone

A real iPhone app. It connects **straight to the camera's Wi-Fi**, so no MacBook or Terminal is needed while you use it. You need the Mac only once, to install it.

## Install it on your iPhone (about 15 minutes, once)

You need: your MacBook, your iPhone, a USB cable, and an Apple ID (the free one you already have is fine).

1. **Install Xcode** on the Mac from the App Store (free, large download).
2. **Get this folder onto the Mac.** On the GitHub page of this repository, click **Code → Download ZIP**, unzip it, and open the `camera/ios` folder. (Or `git clone` it.) Keep the whole `camera` folder: the app uses `camera/public` for its screens.
3. Double-click **`CamControl.xcodeproj`**. Xcode opens.
4. **Add your Apple ID:** Xcode menu → **Settings… → Accounts → +** → Apple ID → sign in.
5. In the left sidebar click the blue **CamControl** project, then the **CamControl** target → **Signing & Capabilities** tab → **Team**: choose your name ("Personal Team"). Leave "Automatically manage signing" on.
6. **Prepare the iPhone:** plug it into the Mac, unlock it, tap **Trust**. On iOS 16 or later, also turn on **Settings → Privacy & Security → Developer Mode** (the iPhone restarts).
7. At the top of Xcode, pick **your iPhone** as the run destination (instead of a simulator), then press **▶ Run** (or ⌘R).
8. The first time, iPhone says the developer is not trusted. Open **Settings → General → VPN & Device Management**, tap your Apple ID, then **Trust**. Press ▶ in Xcode again.

The CamControl icon is now on your home screen.

> **The 7-day rule:** with a free Apple ID, Apple lets self-installed apps run for 7 days. After that the app won't open: connect the iPhone and press ▶ in Xcode again (1 minute, your settings and measurements stay). A paid Apple Developer account ($99/year) makes it last a year.

## Use it

1. Switch the camera on. If it was set up with the V720 app before, hold its side button for 5 seconds until the blue light blinks fast (hotspot mode).
2. iPhone **Settings → Wi-Fi** → join the camera's network (usually `Nax_…` or `MC-…`). "No Internet Connection" is normal.
3. Open **CamControl**. The first time, tap **Allow** when it asks to find devices on your local network. If you tapped Don't Allow: Settings → Privacy & Security → Local Network → CamControl.

CamControl finds the camera by itself, the same way the official V720 app does: it asks the camera "who are you?", learns its ID, and logs in with it. It speaks both the standard protocol (most models) and the newer one (A12, W1). Where it found the camera is remembered, so the next start is instant.

Everything from the browser version is there: live view, night vision, flip, photos and videos (the share sheet opens: **Save Image / Save Video** puts them in Photos), listening to the microphone, SD-card recordings, and the **speed radar** with v = d ÷ t. The radar can also measure a video from your photo library: Setup → Video file.

The app stops streaming when you leave it, to save the camera's battery, and reconnects when you come back.

## If something goes wrong

| Problem | Fix |
|---|---|
| Xcode: "Failed to register bundle identifier" | Your Team isn't selected yet (step 5). If it still fails, change **Bundle Identifier** on the same tab to something unique, e.g. `com.yourname.camcontrol`. |
| Xcode: "Developer Mode disabled" | Step 6. |
| "Camera not found" | Tap **Find camera** (on the picture, or Setup → Find camera). It lists every address it tried and why each failed, and says what to do. Usually: join the camera's Wi-Fi (`Nax_…` / `MC-…`) and allow Local Network access. If the camera is on your home Wi-Fi, try **Search the whole network**, or type its address. |
| Picture freezes | The app reconnects on its own. If it keeps happening, move closer: the range is the camera's Wi-Fi range. |

For debugging, Safari on the Mac can inspect the app: Safari → Settings → Advanced → Show features for web developers, then **Develop → your iPhone → CamControl**.

## How it's built

| File | What it does |
|---|---|
| `CamControl/CameraEngine.swift` | Connects to the camera (TCP 192.168.169.1:6123), handshake, heartbeat, reconnects, IR / flip / reboot, SD card. Same logic as `camera/bridge/camera.js`. |
| `CamControl/CameraProtocol.swift` | Packet format and JPEG re-assembly. Same as `camera/bridge/protocol.js`. |
| `CamControl/AppSchemeHandler.swift` | Serves the screens from `camera/public` and the same API as the Mac bridge, under `camcontrol://app/`. |
| `CamControl/CamWebView.swift` | The app window, and saving files through the share sheet. |
| `CamControl/CamControlApp.swift` | App start, keeps the screen on, pauses when in the background. |

The screens and the radar are the same code as the browser version (`camera/public`), so a change there shows up in the app the next time you press ▶ in Xcode.
