package com.iotsoptv

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.view.View

// Runs while auto-start is ON. Re-opens IotSopTv several times after boot and after
// every wake from standby (remote power button doesn't send BOOT_COMPLETED).
class KeeperService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var overlay: View? = null

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      Log.i(AutoStart.TAG, "Screen event: ${intent.action}")
      runBurst(AutoStart.WAKE_SCHEDULE, "wake")
    }
  }

  override fun onCreate() {
    super.onCreate()
    startAsForeground()
    overlay = AutoStart.addOverlay(this)
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_ON)
      addAction(Intent.ACTION_DREAMING_STOPPED)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(screenReceiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(screenReceiver, filter)
    }
    Log.i(AutoStart.TAG, "KeeperService started (overlay=${overlay != null})")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!AutoStart.isEnabled(this)) {
      stopSelf()
      return START_NOT_STICKY
    }
    if (overlay == null) overlay = AutoStart.addOverlay(this)
    if (intent?.action == ACTION_BOOT) runBurst(AutoStart.BOOT_SCHEDULE, "boot")
    return START_STICKY
  }

  // Every power-on / wake-up turns auto-start back on after an "Exit to TV"
  private fun runBurst(schedule: LongArray, reason: String) {
    handler.removeCallbacksAndMessages(null)
    if (!AutoStart.isEnabled(this)) return
    AutoStart.setPaused(this, false)
    schedule.forEachIndexed { i, sec ->
      handler.postDelayed({
        if (AutoStart.isEnabled(this) && !AutoStart.isPaused(this)) {
          AutoStart.bringToFront(this, "$reason #${i + 1} @${sec}s")
        }
      }, sec * 1000)
    }
  }

  private fun startAsForeground() {
    val nm = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "IotSopTv auto start", NotificationManager.IMPORTANCE_MIN)
      )
    }
    val notification: Notification =
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL)
       else @Suppress("DEPRECATION") Notification.Builder(this))
        .setContentTitle("IotSopTv auto start is on")
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setOngoing(true)
        .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    try { unregisterReceiver(screenReceiver) } catch (_: Exception) {}
    AutoStart.removeOverlay(this, overlay)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val ACTION_BOOT = "com.iotsoptv.autostart.BOOT"
    const val ACTION_KEEP = "com.iotsoptv.autostart.KEEP"
    private const val CHANNEL = "iot_autostart"
    private const val NOTIF_ID = 7101

    fun start(ctx: Context, action: String): Boolean = try {
      val i = Intent(ctx, KeeperService::class.java).setAction(action)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
      true
    } catch (e: Exception) {
      Log.e(AutoStart.TAG, "KeeperService start failed: ${e.message}")
      false
    }

    fun stop(ctx: Context) {
      try { ctx.stopService(Intent(ctx, KeeperService::class.java)) } catch (_: Exception) {}
    }
  }
}
