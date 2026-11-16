import SwiftUI
import UIKit

@main
struct CamControlApp: App {
    @Environment(\.scenePhase) private var scenePhase
    private let camera = CameraEngine.shared

    var body: some Scene {
        WindowGroup {
            CamWebView(camera: camera)
                .ignoresSafeArea()
                .background(Color(red: 0.043, green: 0.059, blue: 0.078).ignoresSafeArea())
                .preferredColorScheme(.dark)
                .onAppear { camera.start() }
        }
        .onChange(of: scenePhase) { phase in
            switch phase {
            case .active:
                // keep the screen on while watching, connect to the camera
                UIApplication.shared.isIdleTimerDisabled = true
                camera.start()
            case .background:
                // save the camera's battery: stop streaming when the app is not visible
                UIApplication.shared.isIdleTimerDisabled = false
                camera.stop()
            default:
                break
            }
        }
    }
}
