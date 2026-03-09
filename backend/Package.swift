// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "DraftlyBackend",
    platforms: [
        .macOS(.v13)
    ],
    dependencies: [
        .package(url: "https://github.com/vapor/vapor.git", from: "4.115.0"),
        .package(url: "https://github.com/vapor/fluent.git", from: "4.9.0"),
        .package(url: "https://github.com/vapor/fluent-sqlite-driver.git", from: "4.0.0"),
        .package(url: "https://github.com/vapor/jwt.git", from: "5.0.0"),
        .package(url: "https://github.com/apple/swift-nio.git", from: "2.65.0"),
    ],
    targets: [
        // Library target — all app logic; testable
        .target(
            name: "App",
            dependencies: [
                .product(name: "Fluent",              package: "fluent"),
                .product(name: "FluentSQLiteDriver",  package: "fluent-sqlite-driver"),
                .product(name: "Vapor",               package: "vapor"),
                .product(name: "JWT",                 package: "jwt"),
                .product(name: "NIOCore",             package: "swift-nio"),
                .product(name: "NIOPosix",            package: "swift-nio"),
            ],
            path: "Sources/App",
            swiftSettings: swiftSettings
        ),
        // Thin executable — just boots the Vapor app
        .executableTarget(
            name: "Run",
            dependencies: [
                .target(name: "App"),
                .product(name: "Vapor", package: "vapor"),
            ],
            path: "Sources/Run",
            swiftSettings: swiftSettings
        ),
        // Test target — imports App library
        .testTarget(
            name: "AppTests",
            dependencies: [
                .target(name: "App"),
                .product(name: "VaporTesting", package: "vapor"),
            ],
            path: "Tests/AppTests",
            swiftSettings: swiftSettings
        ),
    ]
)

var swiftSettings: [SwiftSetting] {
    [
        .enableUpcomingFeature("ExistentialAny")
    ]
}
