emulator -avd Pixel_7
adb start-server
adb devices

npx react-native run-android
npx react-native start --reset-cache

adb reverse tcp:8081 tcp:8081
adb reverse --list
adb uninstall com.soptv

adb logcat *:E ReactNativeJS:V ReactNative:V


------------------------------for make app /apk..
mytvapp123

cd android 
./gradlew clean
./gradlew assembleRelease

 \android\app\build\outputs\apk\release
---------------------------

 adb shell input keyevent 82
adb logcat -s ReactNativeJS
adb logcat -s ReactNativeJS:V

wmic computersystem get TotalPhysicalMemory
--------------------------------------------------------
ip change in mqttservice+api.ts+.env


Settings → Device Preferences → About → Build Number (tap 7 times)
Settings → Device Preferences → Developer Options → USB Debugging ON

# Physical device
adb -s 0412108R40003488 reverse tcp:8081 tcp:8081
adb -s 0412108R40003488 reverse tcp:5004 tcp:5004
adb -s 0412108R40003488 reverse tcp:9001 tcp:9001

npx react-native start --reset-cache

npx react-native run-android
# Run this again — sometimes needed after install
adb -s 0412108R40003488 reverse tcp:8081 tcp:8081
adb devices

# Physical device logs
adb -s 0412108R40003488 logcat -s ReactNativeJS:V

Step 3 — Install app on physical device
npx react-native run-android --device 0412108R40003488
----------------------------------------






4. app size is around 100 mb so it is so big why ????
<!-- ------------------------- -->

1.app crashing on pdf play  in tv it is working in mobile but in tv it is crashing ...


2. remote is  working only on login page ,remote is not working in another page. like player scree or dashboard screen.in sync and play scrool is not working in side bar both ,  mouse is working but remote is not working.

D-pad UP/DOWN moves navFocus index
Each nav item highlights when focused
Remote SELECT triggers that item
No need to physically scroll — focus jumps
Remote OK/Select → opens sidebar
Remote UP/DOWN  → navigates sidebar items (highlight moves)
Remote SELECT   → triggers highlighted nav item
Remote BACK/MENU → closes sidebar or goes back
Works on: PlayerScreen ✅
// Not present in PlayerScreen or DashboardScreen:
useTVEventHandler((evt) => {
  if (evt.eventType === 'select') { /* open sidebar */ }
  if (evt.eventType === 'right')  { /* next file */ }
  if (evt.eventType === 'left')   { /* prev file */ }
  if (evt.eventType === 'up')     { /* volume up */ }
  if (evt.eventType === 'down')   { /* volume down */ }
});

hasTVPreferredFocus={true} → remote auto-focuses the first input on screen load
isTVSelectable={true} → button is focusable by remote
Native Android TV focus chain handles d-pad navigation automatically



3.ppt /power point and excel / csv run in dipslay like pdf right now . check how it possibel in react native.....






