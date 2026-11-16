import Foundation
import WebKit

/// Serves the CamControl web interface (bundled from camera/public) and the same small API that the
/// Mac bridge (camera/server.js) offers, under camcontrol://app/… — so the interface runs unchanged.
/// WebKit calls these methods on the main thread.
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "camcontrol"
    static let startURL = URL(string: "camcontrol://app/index.html")!

    private let camera: CameraEngine
    private let webRoot: URL
    private var live = Set<ObjectIdentifier>()

    init(camera: CameraEngine) {
        self.camera = camera
        self.webRoot = (Bundle.main.url(forResource: "public", withExtension: nil) ?? Bundle.main.bundleURL).standardizedFileURL
        super.init()
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        live.insert(ObjectIdentifier(task))
        guard let url = task.request.url, let comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            respond(task, status: 400, type: "text/plain", data: Data("Bad request".utf8))
            return
        }
        var query: [String: String] = [:]
        for item in comps.queryItems ?? [] { query[item.name] = item.value ?? "" }
        var body: [String: Any] = [:]
        if let b = query["b"], let d = b.data(using: .utf8), let j = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] {
            body = j
        } else if let d = task.request.httpBody, let j = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] {
            body = j
        }
        route(task, path: comps.path.isEmpty ? "/" : comps.path, query: query, body: body)
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        live.remove(ObjectIdentifier(task))
    }

    // MARK: - Routes

    private func route(_ task: WKURLSchemeTask, path: String, query: [String: String], body: [String: Any]) {
        let cam = camera
        switch path {
        case "/api/status":
            var s = cam.statusJSON()
            s["bridgeTime"] = Int(Date().timeIntervalSince1970 * 1000)
            json(task, 200, s)

        case "/api/ir":
            let on = (body["on"] as? Bool) ?? ((body["on"] as? NSNumber)?.boolValue ?? false)
            cam.setIR(on) { [weak self] err in
                if let err = err { self?.json(task, 502, ["error": err]) } else { self?.json(task, 200, ["ok": true, "ir": on]) }
            }

        case "/api/flip":
            let mode = (body["mode"] as? NSNumber)?.intValue ?? 0
            cam.setFlip(mode) { [weak self] err in
                if let err = err { self?.json(task, 502, ["error": err]) } else { self?.json(task, 200, ["ok": true, "flip": mode]) }
            }

        case "/api/discover":
            // "Find camera": quick search, or ?scan=1 to try every address on the Wi-Fi
            let scan = query["scan"] == "1"
            cam.search(scan: scan) { [weak self] res in
                let s = cam.statusJSON()
                self?.json(task, 200, [
                    "found": res.found.map { $0.json },
                    "tried": res.tried.map { $0.json },
                    "networks": res.networks.map { ["name": $0.name, "address": $0.address] },
                    "current": s["camera"] ?? "",
                ])
            }

        case "/api/camera":
            let host = (body["host"] as? String) ?? ""
            let valid = !host.isEmpty && host.unicodeScalars.allSatisfy { CharacterSet(charactersIn: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-").contains($0) }
            guard valid else { json(task, 400, ["error": "Enter an address like 192.168.169.1"]); return }
            let port = UInt16((body["port"] as? NSNumber)?.intValue ?? 6123)
            cam.useCamera(host: host, port: port, proto: body["protocol"] as? String, devId: body["devId"] as? String)
            json(task, 200, ["ok": true])

        case "/api/reboot":
            cam.reboot()
            json(task, 200, ["ok": true])

        case "/api/reconnect":
            cam.reconnect()
            json(task, 200, ["ok": true])

        case "/api/sd/status":
            cam.sdStatus { [weak self] r, err in
                if let r = r { self?.json(task, 200, r) } else { self?.json(task, 502, ["error": err ?? "Failed"]) }
            }

        case "/api/sd/dates":
            cam.sdDates { [weak self] dates, err in
                if let dates = dates { self?.json(task, 200, ["dates": dates]) } else { self?.json(task, 502, ["error": err ?? "Failed"]) }
            }

        case "/api/sd/files":
            let date = Int(query["date"] ?? "") ?? 0
            cam.sdFiles(date: date) { [weak self] files, err in
                if let files = files {
                    let list: [[String: Any]] = files.map { ["hour": $0.hour, "minute": $0.minute] }
                    self?.json(task, 200, ["date": String(date), "files": list])
                } else {
                    self?.json(task, 502, ["error": err ?? "Failed"])
                }
            }

        case "/frame.jpg":
            // Long poll: answers as soon as there is a frame newer than `after`, or with 204 after 3 s.
            let after = Int(query["after"] ?? "") ?? 0
            cam.viewerPoll()
            if cam.frameSeq > after, cam.lastFrame != nil {
                sendFrame(task)
            } else {
                cam.onNextFrame { [weak self] in self?.sendFrame(task) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
                    self?.respond(task, status: 204, type: "text/plain", data: Data())
                }
            }

        case "/audio.chunk":
            let after = Int(query["after"] ?? "") ?? -1
            cam.viewerPoll()
            if cam.audioRing.contains(where: { $0.seq > after }) {
                sendAudio(task, after: after)
            } else {
                cam.onNextAudio { [weak self] in self?.sendAudio(task, after: after) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                    self?.respond(task, status: 204, type: "text/plain", data: Data())
                }
            }

        case "/snapshot.jpg":
            if let f = cam.lastFrame { respond(task, status: 200, type: "image/jpeg", data: f) } else { json(task, 503, ["error": "No picture yet"]) }

        default:
            serveFile(task, path: path)
        }
    }

    private func sendFrame(_ task: WKURLSchemeTask) {
        guard let f = camera.lastFrame else { return }
        respond(task, status: 200, type: "image/jpeg", data: f, extra: [
            "X-Seq": String(camera.frameSeq),
            "X-Timestamp": String(format: "%.2f", camera.frameTimestamp),
        ])
    }

    private func sendAudio(_ task: WKURLSchemeTask, after: Int) {
        var d = Data()
        for c in camera.audioRing where c.seq > after { d.append(c.data) }
        respond(task, status: 200, type: "application/octet-stream", data: d, extra: ["X-Seq": String(camera.audioSeq)])
    }

    private func serveFile(_ task: WKURLSchemeTask, path: String) {
        let rel = path == "/" ? "index.html" : String(path.drop(while: { $0 == "/" }))
        let file = webRoot.appendingPathComponent(rel).standardizedFileURL
        guard file.path.hasPrefix(webRoot.path + "/"), let data = try? Data(contentsOf: file) else {
            json(task, 404, ["error": "Not found"])
            return
        }
        respond(task, status: 200, type: Self.mime(file.pathExtension), data: data)
    }

    private static func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "webmanifest": return "application/manifest+json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        default: return "application/octet-stream"
        }
    }

    // MARK: - Responses

    private func json(_ task: WKURLSchemeTask, _ status: Int, _ obj: [String: Any]) {
        let data = (try? JSONSerialization.data(withJSONObject: obj)) ?? Data("{}".utf8)
        respond(task, status: status, type: "application/json", data: data)
    }

    /// Answers a request once; later calls for the same request (or a cancelled one) are ignored.
    private func respond(_ task: WKURLSchemeTask, status: Int, type: String, data: Data, extra: [String: String] = [:]) {
        let id = ObjectIdentifier(task)
        guard live.contains(id), let url = task.request.url else { return }
        live.remove(id)
        var headers = extra
        headers["Content-Type"] = type
        headers["Content-Length"] = String(data.count)
        headers["Cache-Control"] = "no-store"
        guard let resp = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else { return }
        task.didReceive(resp)
        if !data.isEmpty { task.didReceive(data) }
        task.didFinish()
    }
}
