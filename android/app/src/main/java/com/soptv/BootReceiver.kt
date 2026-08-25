// android/app/src/main/java/com/soptv/BootReceiver.kt
package com.soptv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action

        if (action == Intent.ACTION_BOOT_COMPLETED
            || action == "android.intent.action.QUICKBOOT_POWERON"
            || action == "com.htc.intent.action.QUICKBOOT_POWERON") {

            Log.d("DMS_Boot", "Boot completed — launching DMS TV app")

            try {
                Thread.sleep(2000)
                val launchIntent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                context.startActivity(launchIntent)
                Log.d("DMS_Boot", "App launched successfully")
            } catch (e: Exception) {
                Log.e("DMS_Boot", "Failed: ${e.message}")
            }
        }
    }
}