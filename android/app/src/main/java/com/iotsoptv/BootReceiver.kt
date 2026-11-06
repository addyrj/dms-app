package com.iotsoptv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

// Signage boxes get power-cycled (smart plug schedules, power outages) and
// run unattended — without this, the app would just sit uninstalled-looking
// on the home screen after every reboot until someone manually opens it.
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Log.i(AutoStart.TAG, "Boot broadcast: ${intent.action}")
    val app = context.applicationContext
    if (!AutoStart.isEnabled(app)) return
    AutoStart.setPaused(app, false)

    // Original immediate start — still what makes Android 13 and older TVs work
    try {
      val launchIntent = Intent(context, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(launchIntent)
    } catch (e: Exception) {
      Log.w(AutoStart.TAG, "Immediate start failed: ${e.message}")
    }

    // Retries (Android 14+ blocks the start above unless "Display over other apps" is allowed)
    KeeperService.start(app, KeeperService.ACTION_BOOT)
  }
}
