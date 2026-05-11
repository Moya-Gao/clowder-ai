import AVFoundation
import CoreMedia
import Foundation
import ScreenCaptureKit

@main
struct CaptureAppAudio {
    static func main() async throws {
        let args = CommandLine.arguments

        if args.count < 2 || args[1] == "--help" || args[1] == "-h" {
            printUsage()
            return
        }

        let command = args[1]

        switch command {
        case "list":
            try await listApps()
        case "capture":
            let appName = args.count > 2 ? args[2] : nil
            let duration = args.count > 3 ? Double(args[3]) ?? 10.0 : 10.0
            let output = args.count > 4 ? args[4] : "captured_audio.wav"
            guard let appName = appName else {
                print("Error: app name required. Use 'list' to see available apps.")
                return
            }
            try await captureApp(name: appName, duration: duration, outputPath: output)
        case "stream":
            let appName = args.count > 2 ? args[2] : nil
            let duration = args.count > 3 ? Double(args[3]) ?? 300.0 : 300.0
            let chunkSec = args.count > 4 ? Double(args[4]) ?? 3.0 : 3.0
            guard let appName = appName else {
                log("Error: app name required. Use 'list' to see available apps.")
                return
            }
            try await streamApp(name: appName, duration: duration, chunkSec: chunkSec)
        default:
            print("Unknown command: \(command)")
            printUsage()
        }
    }

    static func log(_ msg: String) {
        FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
    }

    static func printUsage() {
        print("""
        CaptureAppAudio — ScreenCaptureKit per-app audio capture (F195 Spike 1)

        Usage:
          CaptureAppAudio list                              List apps with audio
          CaptureAppAudio capture <app> [dur] [output]      Capture to WAV file
          CaptureAppAudio stream  <app> [dur] [chunk_sec]   Stream Int16 PCM to stdout

        Examples:
          CaptureAppAudio list
          CaptureAppAudio capture "zoom.us" 10 output.wav
          CaptureAppAudio stream "Google Chrome" 300 3.0
        """)
    }

    static func listApps() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        let apps = content.applications
            .filter { $0.applicationName.count > 0 }
            .sorted { $0.applicationName < $1.applicationName }

        print("Available applications (\(apps.count)):")
        print(String(repeating: "-", count: 60))
        for app in apps {
            let bundle = app.bundleIdentifier
            print("  \(app.applicationName) (\(bundle))")
        }
    }

    static func findApp(name: String) async throws -> (SCRunningApplication, SCContentFilter) {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        guard let app = content.applications.first(where: {
            $0.applicationName.localizedCaseInsensitiveContains(name) ||
            $0.bundleIdentifier.localizedCaseInsensitiveContains(name)
        }) else {
            throw NSError(domain: "CaptureAppAudio", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "App '\(name)' not found"])
        }
        let filter = SCContentFilter(display: content.displays[0], including: [app], exceptingWindows: [])
        return (app, filter)
    }

    static func makeStreamConfig() -> SCStreamConfiguration {
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = true
        config.channelCount = 1
        config.sampleRate = 16000
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        return config
    }

    static func captureApp(name: String, duration: Double, outputPath: String) async throws {
        let (app, filter) = try await findApp(name: name)
        print("Target: \(app.applicationName) (\(app.bundleIdentifier))")
        print("Duration: \(duration)s, Output: \(outputPath)")

        let recorder = AudioRecorder(outputPath: outputPath, sampleRate: 16000)
        let stream = SCStream(filter: filter, configuration: makeStreamConfig(), delegate: nil)
        try stream.addStreamOutput(recorder, type: .audio, sampleHandlerQueue: .main)

        print("Starting capture...")
        try await stream.startCapture()

        let startTime = Date()
        while Date().timeIntervalSince(startTime) < duration {
            try await Task.sleep(nanoseconds: 100_000_000)
            let elapsed = Date().timeIntervalSince(startTime)
            if Int(elapsed) % 2 == 0 && elapsed - elapsed.rounded(.down) < 0.15 {
                print("  [\(String(format: "%.1f", elapsed))s] samples: \(recorder.totalSamples)")
            }
        }

        try await stream.stopCapture()
        recorder.writeWav()
        print("\nCapture complete! Samples: \(recorder.totalSamples)")
    }

    static func streamApp(name: String, duration: Double, chunkSec: Double) async throws {
        let (app, filter) = try await findApp(name: name)
        log("Target: \(app.applicationName) (\(app.bundleIdentifier))")
        log("Mode: stream | Duration: \(duration)s | Chunk: \(chunkSec)s")

        let streamer = StreamingRecorder(sampleRate: 16000, chunkSeconds: chunkSec)
        let stream = SCStream(filter: filter, configuration: makeStreamConfig(), delegate: nil)
        try stream.addStreamOutput(streamer, type: .audio, sampleHandlerQueue: .main)

        log("Streaming started — raw Int16 PCM on stdout")
        try await stream.startCapture()

        let startTime = Date()
        while Date().timeIntervalSince(startTime) < duration {
            try await Task.sleep(nanoseconds: 100_000_000)
        }

        try await stream.stopCapture()
        streamer.flushRemaining()
        log("Stream ended. Chunks: \(streamer.chunksWritten), Samples: \(streamer.totalSamples)")
    }
}

class AudioRecorder: NSObject, SCStreamOutput {
    private let outputPath: String
    private let sampleRate: Int
    private var pcmData = Data()
    private(set) var totalSamples: Int = 0

    init(outputPath: String, sampleRate: Int) {
        self.outputPath = outputPath
        self.sampleRate = sampleRate
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        guard let blockBuffer = sampleBuffer.dataBuffer else { return }

        let length = blockBuffer.dataLength
        var data = Data(count: length)
        do {
            try data.withUnsafeMutableBytes { ptr in
                try blockBuffer.copyDataBytes(to: ptr)
            }
        } catch {
            return
        }

        // ScreenCaptureKit delivers Float32 PCM; convert to Int16 for WAV
        let floatCount = length / 4
        data.withUnsafeBytes { rawPtr in
            let floats = rawPtr.bindMemory(to: Float32.self)
            for i in 0..<floatCount {
                let sample = max(-1.0, min(1.0, floats[i]))
                var int16 = Int16(sample * 32767.0)
                pcmData.append(Data(bytes: &int16, count: 2))
            }
        }
        totalSamples += floatCount
    }

    func writeWav() {
        var wavData = Data()
        let dataSize = UInt32(pcmData.count)
        let sr = UInt32(self.sampleRate)
        wavData.append("RIFF".data(using: .ascii)!)
        wavData.append(withUnsafeBytes(of: UInt32(36 + pcmData.count).littleEndian) { Data($0) })
        wavData.append("WAVE".data(using: .ascii)!)
        wavData.append("fmt ".data(using: .ascii)!)
        wavData.append(withUnsafeBytes(of: UInt32(16).littleEndian) { Data($0) })
        wavData.append(withUnsafeBytes(of: UInt16(1).littleEndian) { Data($0) })
        wavData.append(withUnsafeBytes(of: UInt16(1).littleEndian) { Data($0) })
        wavData.append(withUnsafeBytes(of: sr.littleEndian) { Data($0) })
        wavData.append(withUnsafeBytes(of: UInt32(sampleRate * 2).littleEndian) { Data($0) })
        wavData.append(withUnsafeBytes(of: UInt16(2).littleEndian) { Data($0) })
        wavData.append(withUnsafeBytes(of: UInt16(16).littleEndian) { Data($0) })
        wavData.append("data".data(using: .ascii)!)
        wavData.append(withUnsafeBytes(of: dataSize.littleEndian) { Data($0) })
        wavData.append(pcmData)
        try? wavData.write(to: URL(fileURLWithPath: outputPath))
    }
}

class StreamingRecorder: NSObject, SCStreamOutput {
    private let sampleRate: Int
    private let chunkBytes: Int
    private var buffer = Data()
    private(set) var totalSamples: Int = 0
    private(set) var chunksWritten: Int = 0
    private let stdout = FileHandle.standardOutput

    init(sampleRate: Int, chunkSeconds: Double) {
        self.sampleRate = sampleRate
        self.chunkBytes = Int(chunkSeconds * Double(sampleRate)) * 2
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, let blockBuffer = sampleBuffer.dataBuffer else { return }

        let length = blockBuffer.dataLength
        var data = Data(count: length)
        do {
            try data.withUnsafeMutableBytes { try blockBuffer.copyDataBytes(to: $0) }
        } catch { return }

        let floatCount = length / 4
        data.withUnsafeBytes { rawPtr in
            let floats = rawPtr.bindMemory(to: Float32.self)
            for i in 0..<floatCount {
                var int16 = Int16(max(-1.0, min(1.0, floats[i])) * 32767.0)
                buffer.append(Data(bytes: &int16, count: 2))
            }
        }
        totalSamples += floatCount

        while buffer.count >= chunkBytes {
            stdout.write(buffer.prefix(chunkBytes))
            buffer = Data(buffer.dropFirst(chunkBytes))
            chunksWritten += 1
            CaptureAppAudio.log("chunk \(chunksWritten) flushed (\(totalSamples) total samples)")
        }
    }

    func flushRemaining() {
        if !buffer.isEmpty {
            stdout.write(buffer)
            buffer = Data()
            chunksWritten += 1
            CaptureAppAudio.log("final chunk \(chunksWritten) flushed (partial)")
        }
    }
}
