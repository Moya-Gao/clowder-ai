// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CaptureAppAudio",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "CaptureAppAudio",
            path: "Sources",
            linkerSettings: [
                .linkedFramework("ScreenCaptureKit"),
                .linkedFramework("AVFoundation"),
                .linkedFramework("CoreMedia"),
            ]
        )
    ]
)
