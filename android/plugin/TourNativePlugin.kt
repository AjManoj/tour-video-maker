package com.tourvideomaker.app

import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Environment
import android.util.Base64
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import org.json.JSONObject
import java.io.File

/**
 * Native helpers for the Day Tour Video Maker.
 *
 * JS:  const { TourNative } = Capacitor.Plugins
 *      await TourNative.info()
 *      await TourNative.detectFaces({ imageBase64 })            // JPEG/PNG, with or without data: prefix
 *      await TourNative.exportProject({ projectJson, outName })
 *
 * projectJson (string or object):
 *   { "width":1080, "height":1920, "fps":30,
 *     "items":[ { "uri":"samples/gate.jpg", "kind":"image", "durationMs":2600 },
 *               { "uri":"content://...", "kind":"video", "startMs":1000, "endMs":4600 } ] }
 *   uri: content:// or file:// (from the gallery picker / Filesystem), or a path inside the
 *        app's bundled web assets (e.g. "samples/x.mp4" -> asset:///public/samples/x.mp4).
 *        blob: URLs from the WebView cannot be read natively; the web layer must pass real URIs.
 */
@CapacitorPlugin(name = "TourNative")
class TourNativePlugin : Plugin() {

    @PluginMethod
    fun info(call: PluginCall) {
        val r = JSObject()
        r.put("ok", true)
        r.put("media3", true)
        r.put("mlkit", true)
        r.put("version", "0.1.0")
        call.resolve(r)
    }

    // ---------- ML Kit face + smile detection ----------
    @PluginMethod
    fun detectFaces(call: PluginCall) {
        val b64 = call.getString("imageBase64")
        if (b64.isNullOrEmpty()) {
            call.reject("imageBase64 is required")
            return
        }
        val bytes = try {
            Base64.decode(b64.substringAfter("base64,", b64), Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            call.reject("imageBase64 is not valid base64", e)
            return
        }
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        if (bitmap == null) {
            call.reject("Could not decode image")
            return
        }
        val options = FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
            .setMinFaceSize(0.08f)
            .build()
        val detector = FaceDetection.getClient(options)
        detector.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener { faces ->
                val arr = JSArray()
                for (f in faces) {
                    val b = f.boundingBox
                    val o = JSObject()
                    // Normalised 0..1 so the web layer can map onto any canvas size.
                    o.put("x", b.left.toDouble() / bitmap.width)
                    o.put("y", b.top.toDouble() / bitmap.height)
                    o.put("w", b.width().toDouble() / bitmap.width)
                    o.put("h", b.height().toDouble() / bitmap.height)
                    o.put("smile", (f.smilingProbability ?: -1f).toDouble())
                    o.put("eyesOpen", (((f.leftEyeOpenProbability ?: 0f) + (f.rightEyeOpenProbability ?: 0f)) / 2f).toDouble())
                    arr.put(o)
                }
                val r = JSObject()
                r.put("faces", arr)
                r.put("width", bitmap.width)
                r.put("height", bitmap.height)
                call.resolve(r)
                detector.close()
            }
            .addOnFailureListener { e ->
                call.reject("Face detection failed: ${e.message}", e)
                detector.close()
            }
    }

    // ---------- Media3 Transformer export ----------
    @OptIn(UnstableApi::class)
    @PluginMethod
    fun exportProject(call: PluginCall) {
        val project: JSONObject = try {
            call.getObject("project")?.let { JSONObject(it.toString()) }
                ?: JSONObject(call.getString("projectJson") ?: "{}")
        } catch (e: Exception) {
            call.reject("projectJson is not valid JSON", e)
            return
        }
        val items = project.optJSONArray("items")
        if (items == null || items.length() == 0) {
            call.reject("project has no items")
            return
        }
        val width = project.optInt("width", 1080)
        val height = project.optInt("height", 1920)
        val fps = project.optInt("fps", 30)
        val outName = (call.getString("outName") ?: "tour_${System.currentTimeMillis()}.mp4")
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .let { if (it.endsWith(".mp4")) it else "$it.mp4" }

        // App-specific Movies folder: no storage permission needed.
        val outDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES) ?: context.filesDir
        val outFile = File(outDir, outName)
        if (outFile.exists()) outFile.delete()

        // Every clip is scaled + cropped to the vertical frame.
        val frame = Presentation.createForWidthAndHeight(width, height, Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP)
        val effects = Effects(listOf(), listOf(frame))

        val edited = ArrayList<EditedMediaItem>()
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val uri = resolveUri(item.optString("uri"))
            val kind = item.optString("kind", "image")
            val built = if (kind == "image") {
                val mi = MediaItem.Builder()
                    .setUri(uri)
                    .setImageDurationMs(item.optLong("durationMs", 2600))
                    .build()
                EditedMediaItem.Builder(mi)
                    .setFrameRate(fps)
                    .setEffects(effects)
                    .build()
            } else {
                val clip = MediaItem.ClippingConfiguration.Builder()
                    .setStartPositionMs(item.optLong("startMs", 0))
                    .apply { if (item.has("endMs")) setEndPositionMs(item.getLong("endMs")) }
                    .build()
                val mi = MediaItem.Builder().setUri(uri).setClippingConfiguration(clip).build()
                // TODO(audio): images have no audio track, so clip audio is dropped for now.
                //   Mixing needs every item to carry audio (silent audio for images) or a
                //   separate audio sequence in the Composition.
                EditedMediaItem.Builder(mi)
                    .setRemoveAudio(true)
                    .setEffects(effects)
                    .build()
            }
            edited.add(built)
        }
        // TODO(overlays): titles, captions, chapter badges and the route map are drawn by the
        //   web canvas today. Port them as Media3 OverlayEffect / TextOverlay per item.
        // TODO(transitions): Media3 sequences hard-cut between items; crossfades need a
        //   custom GlEffect or overlapping sequences.

        val composition = Composition.Builder(listOf(EditedMediaItemSequence(edited))).build()

        // Transformer is bound to the thread that builds it and must be built and started
        // on a thread with a Looper, so do both on the main thread.
        activity.runOnUiThread {
            try {
                val transformer = Transformer.Builder(context)
                    .setVideoMimeType(MimeTypes.VIDEO_H264)
                    .addListener(object : Transformer.Listener {
                        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                            val r = JSObject()
                            r.put("ok", true)
                            r.put("path", outFile.absolutePath)
                            r.put("durationMs", exportResult.durationMs)
                            r.put("bytes", exportResult.fileSizeBytes)
                            call.resolve(r)
                        }

                        override fun onError(
                            composition: Composition,
                            exportResult: ExportResult,
                            exportException: ExportException
                        ) {
                            call.reject("Export failed: ${exportException.message}", exportException)
                        }
                    })
                    .build()
                transformer.start(composition, outFile.absolutePath)
            } catch (e: Exception) {
                call.reject("Could not start export: ${e.message}", e)
            }
        }
    }

    /** content:// and file:// pass through; bare paths point at the bundled web assets. */
    private fun resolveUri(raw: String): Uri {
        if (raw.startsWith("content://") || raw.startsWith("file://") || raw.startsWith("asset://")) {
            return Uri.parse(raw)
        }
        if (raw.startsWith("/")) return Uri.fromFile(File(raw))
        // Capacitor serves www/ from assets/public/
        val clean = raw.removePrefix("./").substringBefore("?")
        return Uri.parse("asset:///public/$clean")
    }
}
