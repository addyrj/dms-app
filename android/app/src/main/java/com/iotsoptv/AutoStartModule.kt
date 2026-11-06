package com.iotsoptv

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

class AutoStartModule(rc: ReactApplicationContext) : ReactContextBaseJavaModule(rc) {
  override fun getName() = "AutoStart"

  @ReactMethod
  fun getState(promise: Promise) {
    val ctx = reactApplicationContext
    promise.resolve(Arguments.createMap().apply {
      putBoolean("enabled", AutoStart.isEnabled(ctx))
      putBoolean("canOverlay", AutoStart.canDrawOverlays(ctx))
    })
  }

  @ReactMethod
  fun setEnabled(enabled: Boolean) {
    val ctx = reactApplicationContext
    AutoStart.setEnabled(ctx, enabled)
    AutoStart.setPaused(ctx, false)
    if (enabled) {
      if (AutoStart.canDrawOverlays(ctx)) KeeperService.start(ctx, KeeperService.ACTION_KEEP)
      else AutoStart.openOverlaySettings(ctx)
    } else {
      KeeperService.stop(ctx)
    }
  }

  @ReactMethod
  fun exitToTv() {
    val ctx = reactApplicationContext
    AutoStart.setPaused(ctx, true)
    AutoStart.openTvHome(ctx)
  }
}

class AutoStartPackage : ReactPackage {
  override fun createNativeModules(rc: ReactApplicationContext): List<NativeModule> = listOf(AutoStartModule(rc))
  override fun createViewManagers(rc: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
