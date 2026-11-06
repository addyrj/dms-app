package com.iotsoptv

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

// Renders PDF pages with Android's own PdfRenderer (part of the OS since
// API 21) instead of the bundled PDFium native library that react-native-pdf
// uses (io.legere.pdfiumandroid / libpdfium.so). That library had a
// confirmed, unpatched native crash — SIGSEGV inside libpdfium.so, one
// page's close() racing another page's render() on shared FreeType state —
// reproduced repeatedly on real hardware. Each page is rendered once to a
// PNG on disk and shown as a plain <Image> on the JS side, so it can't hit
// that race at all: there is no long-lived shared renderer state exposed
// across concurrent calls the way PDFium's wrapper had.
class PdfPageModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "PdfPageModule"

  private var renderer: PdfRenderer? = null
  private var fd: ParcelFileDescriptor? = null
  private var openPath: String? = null

  private val cacheDir: File
    get() {
      val dir = File(reactApplicationContext.cacheDir, "pdf_pages")
      if (!dir.exists()) dir.mkdirs()
      return dir
    }

  private fun closeCurrentLocked() {
    try { renderer?.close() } catch (_: Exception) {}
    try { fd?.close() } catch (_: Exception) {}
    renderer = null
    fd = null
    openPath = null
  }

  // Opens (or reuses, if already open) the renderer for this path. Must
  // only be called from within a `synchronized(this)` block.
  private fun ensureOpenLocked(path: String): PdfRenderer {
    if (openPath == path && renderer != null) return renderer!!
    closeCurrentLocked()
    // Rendered pages are timestamped (see renderPage) so they never collide
    // with a stale cached image, but that means they're never overwritten
    // either — clear out old ones whenever a genuinely new document opens.
    try { cacheDir.listFiles()?.forEach { it.delete() } } catch (_: Exception) {}
    val file = File(path.removePrefix("file://"))
    val newFd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    val newRenderer = PdfRenderer(newFd)
    fd = newFd
    renderer = newRenderer
    openPath = path
    return newRenderer
  }

  @ReactMethod
  fun openDocument(path: String, promise: Promise) {
    try {
      synchronized(this) {
        val r = ensureOpenLocked(path)
        val map = Arguments.createMap()
        map.putInt("pageCount", r.pageCount)
        promise.resolve(map)
      }
    } catch (e: Exception) {
      Log.e("PdfPageModule", "openDocument failed: ${e.message}", e)
      promise.reject("OPEN_FAILED", e.message, e)
    }
  }

  // maxWidth/maxHeight describe the screen's box. Each page is fit to that
  // box using ITS OWN actual dimensions (read fresh from this page, not
  // borrowed from a different page) — a page-1-only calibration applied to
  // every other page was the root cause of pages with different margins
  // getting over-stretched and cropped. zoom (e.g. 1.04) then grows the fit
  // slightly beyond the box on all sides equally, to be cropped off by the
  // caller's overflow:hidden wrapper — the same "trim the blank margin"
  // trick as before, but now correctly calibrated per page.
  @ReactMethod
  fun renderPage(path: String, pageIndex: Int, maxWidth: Double, maxHeight: Double, zoom: Double, promise: Promise) {
    try {
      synchronized(this) {
        val r = ensureOpenLocked(path)
        if (pageIndex < 0 || pageIndex >= r.pageCount) {
          throw IllegalArgumentException("Page index $pageIndex out of range (0..${r.pageCount - 1})")
        }

        // Filename includes a timestamp so every render is a genuinely new
        // file — RN's Android image loader (Fresco) caches by URI, and a
        // fixed per-page filename meant an updated render at a new size
        // could still show the previous, now-stale cached bitmap.
        val safeName = "${path.hashCode()}_${pageIndex}_${System.currentTimeMillis()}.png"
        val outFile = File(cacheDir, safeName)

        r.openPage(pageIndex).use { page ->
          val fitScale = minOf(maxWidth / page.width, maxHeight / page.height)
          var scale = fitScale * zoom

          // Cap the longer edge so a high-density screen can't demand a
          // bitmap large enough to risk OOM on lower-end TV hardware.
          val longerEdge = maxOf(page.width * scale, page.height * scale)
          val maxEdge = 2200.0
          if (longerEdge > maxEdge) scale *= (maxEdge / longerEdge)

          // Historical PdfRenderer quirk on some OS versions: a bitmap whose
          // width isn't a multiple of 4 can render corrupted — round up.
          val w = (maxOf(1, (page.width * scale).toInt()) + 3) / 4 * 4
          val h = maxOf(1, (page.height * scale).toInt())

          val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
          bitmap.eraseColor(Color.WHITE)

          val matrix = Matrix()
          matrix.setScale(w.toFloat() / page.width.toFloat(), h.toFloat() / page.height.toFloat())
          page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

          FileOutputStream(outFile).use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, out)
          }
          bitmap.recycle()

          val map = Arguments.createMap()
          map.putString("uri", outFile.absolutePath)
          map.putInt("width", w)
          map.putInt("height", h)
          promise.resolve(map)
        }
      }
    } catch (e: Exception) {
      Log.e("PdfPageModule", "renderPage failed: ${e.message}", e)
      promise.reject("RENDER_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun closeDocument(promise: Promise) {
    try {
      synchronized(this) { closeCurrentLocked() }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CLOSE_FAILED", e.message, e)
    }
  }
}
