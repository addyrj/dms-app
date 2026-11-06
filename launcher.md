# AutoLauncher_IotSopTv - Setup Guide

## What is this?

A small helper app that opens the IotSopTv (DMS) app automatically every time the TV turns ON.

- Does NOT change the DMS app
- Does NOT need internet
- One-time setup, no computer or technical steps needed
- Works on Android 10, 11, 12, 13, 14, 15, 16

> Android 10–13 TVs: optional (IotSopTv already auto-starts there).
> Android 14+ TVs: required.


## Which APK to use?

| File (in the `apk` folder) | Use For |
|----------|---------|
| `AutoLauncher_IotSopTv.apk` | Most TVs, try this first |
| `AutoLauncher_IotSopTv_universal.apk` | If the first one doesn't install, use this (works on ALL TVs) |


## Setup (only once per TV)

**Make sure IotSopTv is installed and logged in first.**

### Step 1: Install from pendrive
1. Copy `AutoLauncher_IotSopTv.apk` to a pendrive and plug it into the TV
2. Open **File Manager** on the TV, then go to the pendrive and select the APK
3. If the TV asks "Allow install from unknown sources?", tap **Allow**
4. Tap **Install**

### Step 2: Open AutoLauncher once and answer the screens that appear
1. After the install finishes, tap **Open**, or open **AutoLauncher_IotSopTv** from the apps list
2. **If a popup asks "Set AutoLauncher_IotSopTv as your default home app?"**, select **AutoLauncher_IotSopTv** and tap **SET AS DEFAULT**.
   (Some TVs, e.g. Samtronic, don't show this. That's fine.)
3. **If a "Display over other apps" screen opens**, find **AutoLauncher_IotSopTv**, turn it **ON / Allow**, then press **Back**.
4. IotSopTv opens automatically

### Step 3: Done!
From now on, every time the TV turns ON:

```
TV Powers ON
    ↓
"Launching IotSopTv..." (3 seconds)
    ↓
IotSopTv opens automatically. Content plays.
```

Pressing the remote's **HOME** button also brings IotSopTv back.

**Works for both kinds of switching on:**
- **Power plug / wall switch:** IotSopTv is brought to the front at 8, 20, 35, 60, 90 and 120 seconds after start-up
- **Remote power button (standby):** IotSopTv is brought to the front at 3, 10, 20, 35, 60 and 90 seconds after wake-up

If the TV's own home screen or live TV covers IotSopTv, the next attempt brings it back.
Note: for those first 2 minutes, if someone opens another app, IotSopTv will come back on top. After that, other apps can be used normally.


## How to use other TV apps (exit IotSopTv)

1. Press **HOME** on the remote (or **Back** inside IotSopTv)
2. The AutoLauncher menu appears: *"Opening IotSopTv in 10s"*
3. Press **↓ arrow**: the countdown stops. Select **📺 Open TV Apps** and press **OK**
4. The normal TV home screen opens. Use any app (YouTube, Live TV, etc.)

While auto-start is paused, IotSopTv will **not** pop up by itself.
Pressing HOME shows the menu (yellow "Auto-start is paused"). Choose **▶ Open IotSopTv** to go back.

**Auto-start turns back on by itself** the next time the TV is switched on (plug or remote).
So the client never has to remember to turn it on again.

| Menu button | What it does |
|---|---|
| ▶ Open IotSopTv | Opens IotSopTv now and turns auto-start back on |
| 📺 Open TV Apps | Opens the normal TV home screen and pauses auto-start |
| ⚙ Settings | Opens TV Settings |

If nobody presses anything, IotSopTv opens after 10 seconds.


## Troubleshooting

**Popup did not appear, and a Settings screen opened instead**
That screen is the TV's Home-app setting. Select **AutoLauncher_IotSopTv** there and press Back.

**Accidentally tapped Cancel**
Open AutoLauncher_IotSopTv again from the apps list. The popup will show again.

**IotSopTv does not open**
Make sure IotSopTv is installed, then restart the TV.

**Want to go back to the normal TV home screen**
TV Settings → Apps → AutoLauncher_IotSopTv → **Uninstall**. The DMS app is not affected.
