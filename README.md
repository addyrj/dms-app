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













