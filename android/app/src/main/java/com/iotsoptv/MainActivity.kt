package com.iotsoptv

import android.os.Build
import android.widget.Toast
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "IotSopTv"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onResume() {
    super.onResume()
    if (!AutoStart.isEnabled(this)) return
    if (AutoStart.canDrawOverlays(this)) {
      // Keeps auto-start running so standby wake-ups work without waiting for a reboot
      KeeperService.start(this, KeeperService.ACTION_KEEP)
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && !AutoStart.askedOverlay(this)) {
      // Android 14+ only starts apps at power-on with this permission; ask once
      AutoStart.setAskedOverlay(this)
      Toast.makeText(
        this,
        "To start IotSopTv automatically when the TV turns on, allow \"Display over other apps\"",
        Toast.LENGTH_LONG
      ).show()
      AutoStart.openOverlaySettings(this)
    }
  }
}
