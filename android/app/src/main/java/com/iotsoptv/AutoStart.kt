package com.iotsoptv

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager

// Auto-start on TV power-on. "enabled" is the user's ON/OFF switch (default ON).
// "paused" is set by "Exit to TV" and cleared on the next power-on / wake-up.
object AutoStart {
  const val TAG = "IotAutoStart"
  private const val PREFS = "iot_autostart"

  // Seconds after boot / wake-up at which IotSopTv is brought to the front again,
  // because slow TVs load their own home screen / live TV late and cover it.
  val BOOT_SCHEDULE = longArrayOf(8, 20, 35, 60, 90, 120)
  val WAKE_SCHEDULE = longArrayOf(3, 10, 20, 35, 60, 90)

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun isEnabled(ctx: Context) = prefs(ctx).getBoolean("enabled", true)
  fun setEnabled(ctx: Context, v: Boolean) = prefs(ctx).edit().putBoolean("enabled", v).apply()
  fun isPaused(ctx: Context) = prefs(ctx).getBoolean("paused", false)
  fun setPaused(ctx: Context, v: Boolean) = prefs(ctx).edit().putBoolean("paused", v).apply()
  fun askedOverlay(ctx: Context) = prefs(ctx).getBoolean("askedOverlay", false)
  fun setAskedOverlay(ctx: Context) = prefs(ctx).edit().putBoolean("askedOverlay", true).apply()

  fun canDrawOverlays(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(ctx)

  // Same as clicking the app icon: brings the running app to the front without restarting it
  fun bringToFront(ctx: Context, reason: String) {
    try {
      val i = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
        ?: Intent(ctx, MainActivity::class.java)
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(i)
      Log.i(TAG, "Bring to front ($reason)")
    } catch (e: Exception) {
      Log.e(TAG, "Bring to front failed ($reason): ${e.message}")
    }
  }

  fun openTvHome(ctx: Context) {
    try {
      ctx.startActivity(
        Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    } catch (e: Exception) {
      Log.e(TAG, "Open TV home failed: ${e.message}")
    }
  }

  fun openOverlaySettings(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    for (i in listOf(
      Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:${ctx.packageName}")),
      Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION),
    )) {
      try {
        ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return
      } catch (_: Exception) {}
    }
  }

  // Tiny transparent overlay. While shown, Android allows background activity starts
  // (required on Android 15+) and treats the process as in use, so it isn't killed.
  fun addOverlay(ctx: Context): View? {
    if (!canDrawOverlays(ctx) || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
    val wm = ctx.getSystemService(WindowManager::class.java) ?: return null
    return try {
      val params = WindowManager.LayoutParams(
        1, 1,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT
      ).apply { gravity = Gravity.TOP or Gravity.START }
      val v = View(ctx).apply { setBackgroundColor(Color.argb(1, 0, 0, 0)) }
      wm.addView(v, params)
      v
    } catch (e: Exception) {
      Log.w(TAG, "Overlay add failed: ${e.message}")
      null
    }
  }

  fun removeOverlay(ctx: Context, v: View?) {
    if (v == null) return
    try { ctx.getSystemService(WindowManager::class.java)?.removeView(v) } catch (_: Exception) {}
  }
}
