═══════════════════════════════════════════════════════════════
APK SIZE REDUCTION — 100 MB → ~35-45 MB
═══════════════════════════════════════════════════════════════

FILE: android/app/build.gradle

── STEP 1: Enable ABI splits (biggest win ~30 MB) ────────────

Find the `android { ... }` block and ADD this inside it:

android {
    ...

    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a"      // Most Android TV boxes
            universalApk false        // Don't build fat APK
        }
    }

    ...
}


── STEP 2: Enable Proguard/R8 minification (~15 MB) ──────────

Find `buildTypes { release { ... } }` and change:

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true              // ← CHANGE from false
            shrinkResources true            // ← ADD this
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }


── STEP 3: Use Hermes only, disable JSC (~10 MB) ─────────────

FILE: android/gradle.properties

Make sure these are set:

    hermesEnabled=true
    newArchEnabled=false


── STEP 4: Remove unused packages (~15 MB) ───────────────────

Run these on your project root:

    npm uninstall react_native_mqtt
    npm uninstall react-native-webview     # only if you don't use WebView
    npm uninstall react-native-blob-util   # only if RNFS handles everything

Then:
    cd android && ./gradlew clean
    cd .. && npx react-native run-android


── STEP 5: Enable resource shrinking in proguard-rules.pro ───

FILE: android/app/proguard-rules.pro

Add these lines:

    -keep class com.facebook.react.** { *; }
    -keep class com.facebook.hermes.** { *; }
    -keep class com.soptv.** { *; }
    -dontwarn com.facebook.react.**


═══════════════════════════════════════════════════════════════
BUILD COMMAND (after all changes):
═══════════════════════════════════════════════════════════════

    cd android
    ./gradlew clean
    ./gradlew assembleRelease

Output APK will be at:
    android/app/build/outputs/apk/release/app-arm64-v8a-release.apk

Expected size: 35-45 MB (down from 100 MB)

═══════════════════════════════════════════════════════════════