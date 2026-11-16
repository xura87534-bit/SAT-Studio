import SwiftUI
import UIKit
import WebKit

/// Shows the CamControl interface and handles what the web page can't do by itself inside an app:
/// saving photos/videos/CSV (share sheet → Save to Photos / Files) and downloading SD-card recordings.
struct CamWebView: UIViewRepresentable {
    let camera: CameraEngine

    func makeCoordinator() -> Coordinator { Coordinator(camera: camera) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(context.coordinator.schemeHandler, forURLScheme: AppSchemeHandler.scheme)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(context.coordinator, name: "camcontrol")

        let web = WKWebView(frame: .zero, configuration: config)
        let bg = UIColor(red: 0.043, green: 0.059, blue: 0.078, alpha: 1)
        web.isOpaque = false
        web.backgroundColor = bg
        web.scrollView.backgroundColor = bg
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { web.isInspectable = true } // Safari → Develop menu on the Mac
        context.coordinator.webView = web
        web.load(URLRequest(url: AppSchemeHandler.startURL))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        let camera: CameraEngine
        let schemeHandler: AppSchemeHandler
        weak var webView: WKWebView?

        init(camera: CameraEngine) {
            self.camera = camera
            self.schemeHandler = AppSchemeHandler(camera: camera)
            super.init()
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let msg = message.body as? [String: Any], let type = msg["type"] as? String else { return }
            switch type {
            case "save":
                guard let name = msg["name"] as? String,
                      let b64 = msg["data"] as? String,
                      let data = Data(base64Encoded: b64) else { toast("Couldn’t save the file"); return }
                let url = FileManager.default.temporaryDirectory.appendingPathComponent(Self.safeName(name))
                do {
                    try data.write(to: url, options: .atomic)
                    share(url)
                } catch {
                    toast("Couldn’t save: \(error.localizedDescription)")
                }

            case "sdDownload":
                let date = Self.int(msg["date"])
                let hour = Self.int(msg["hour"])
                let minute = Self.int(msg["minute"])
                camera.sdDownload(date: date, hour: hour, minute: minute) { [weak self] url, err in
                    if let url = url { self?.share(url) } else { self?.toast(err ?? "Download failed") }
                }

            default:
                break
            }
        }

        private static func int(_ v: Any?) -> Int {
            if let n = v as? NSNumber { return n.intValue }
            if let s = v as? String { return Int(s) ?? 0 }
            return 0
        }

        private static func safeName(_ name: String) -> String {
            let cleaned = name.components(separatedBy: CharacterSet(charactersIn: "/\\:")).joined(separator: "-")
            return cleaned.isEmpty ? "file" : cleaned
        }

        private func share(_ url: URL) {
            guard let web = webView, var top = web.window?.rootViewController else { return }
            while let presented = top.presentedViewController { top = presented }
            let vc = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let pop = vc.popoverPresentationController { // iPad
                pop.sourceView = web
                pop.sourceRect = CGRect(x: web.bounds.midX, y: web.bounds.midY, width: 1, height: 1)
                pop.permittedArrowDirections = []
            }
            top.present(vc, animated: true)
        }

        private func toast(_ text: String) {
            guard let data = try? JSONSerialization.data(withJSONObject: [text]),
                  let arr = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.__ccNative && window.__ccNative.toast(\(arr)[0])", completionHandler: nil)
        }
    }
}
