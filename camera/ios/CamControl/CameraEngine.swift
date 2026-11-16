import Foundation
import Network

/// Finds the camera (like the official V720 app), keeps a TCP connection to it, reconnects when it
/// drops, and streams video only while the app is looking at it. Handles both packet formats:
///   v1 — most V720 cameras (A9, X5, M1 …): commands wrapped in code 502
///   v2 — newer models (A12, W1): plain JSON commands, video cmd 1003
/// Mirrors camera/bridge/camera.js. Everything runs on the main queue, so no locking is needed.
final class CameraEngine {
    static let shared = CameraEngine()

    enum State: String { case idle, searching, connecting, connected, disconnected }

    /// Where the camera is (remembered between launches so the next start is instant).
    struct Target {
        var host: String
        var port: UInt16
        var proto: String?
        var devId: String?
        var stale = false
    }

    private(set) var state: State = .idle
    private(set) var info: [String: Any] = [:]
    private(set) var lastError: String?
    private(set) var lastSearch: [String: Any]?
    private(set) var lastFrame: Data?
    private(set) var frameSeq = 0
    private(set) var frameTimestamp: Double = 0 // ms since 1970, when the frame was complete
    private(set) var streaming = false
    private(set) var busy = false
    private(set) var audioSeq = 0
    private(set) var audioRing: [(seq: Int, data: Data)] = []
    private(set) var target: Target?

    var ir: Bool {
        get { UserDefaults.standard.bool(forKey: "cc.ir") }
        set { UserDefaults.standard.set(newValue, forKey: "cc.ir") }
    }
    var flip: Int {
        get { UserDefaults.standard.integer(forKey: "cc.flip") }
        set { UserDefaults.standard.set(newValue, forKey: "cc.flip") }
    }

    private var frameWaiters: [() -> Void] = []
    private var audioWaiters: [() -> Void] = []
    private var frameTimes: [Double] = []
    private var lastFrameAt: Date?
    private var streamStartedAt = Date.distantPast
    private var lastViewerAt = Date.distantPast

    private var conn: NWConnection?
    private var generation = 0
    private var running = false
    private var searching = false
    private var backoff: TimeInterval = 1
    private var parser = PacketParser()
    private var jpeg = JpegAssembler()
    private var pending: [Pending] = []
    private var nextPendingId = 0
    private var firstPacketHook: ((Kind) -> Void)?
    private var xmlWaiter: (([UInt8]?) -> Void)?
    private var heartbeat: Timer?
    private var watchdog: Timer?
    private var download: DownloadJob?

    private var isV2: Bool { target?.proto == "v2" }
    private var devTargetId: String { target?.devId ?? devTarget }

    private enum Kind { case json, jpeg, audio, xml, live, heartbeat, ping, pong, other }

    private struct Pending {
        let id: Int
        let key: Int?
        let completion: ([String: Any]?) -> Void
    }

    private final class DownloadJob {
        let url: URL
        let handle: FileHandle
        let done: (URL?, String?) -> Void
        var bytes = 0
        var idle: Timer?
        init(url: URL, handle: FileHandle, done: @escaping (URL?, String?) -> Void) {
            self.url = url
            self.handle = handle
            self.done = done
        }
    }

    init() {
        if let d = UserDefaults.standard.dictionary(forKey: "cc.camera"), let host = d["host"] as? String {
            target = Target(host: host, port: UInt16((d["port"] as? Int) ?? 6123), proto: d["protocol"] as? String, devId: d["devId"] as? String)
        }
    }

    private func saveTarget() {
        guard let t = target else { UserDefaults.standard.removeObject(forKey: "cc.camera"); return }
        var d: [String: Any] = ["host": t.host, "port": Int(t.port)]
        if let p = t.proto { d["protocol"] = p }
        if let id = t.devId { d["devId"] = id }
        UserDefaults.standard.set(d, forKey: "cc.camera")
    }

    // MARK: - Life cycle

    func start() {
        guard !running else { return }
        running = true
        backoff = 1
        connect()
        watchdog?.invalidate()
        watchdog = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in self?.watch() }
    }

    func stop() {
        running = false
        watchdog?.invalidate()
        watchdog = nil
        teardown()
        setState(.idle)
    }

    func reconnect() {
        backoff = 0.5
        if conn != nil { drop(generation) } else if running && !searching { connect() }
    }

    /// Use this camera from now on (from the search results or a typed address).
    func useCamera(host: String, port: UInt16, proto: String?, devId: String?) {
        target = Target(host: host, port: port, proto: proto, devId: devId)
        saveTarget()
        reconnect()
    }

    private func setState(_ s: State) { state = s }

    // MARK: - Finding the camera

    /// Looks for cameras (also used by the "Find camera" button).
    func search(scan: Bool, done: @escaping (CameraDiscovery.SearchResult) -> Void) {
        if state != .connected { setState(.searching) }
        CameraDiscovery.search(preferred: target?.host, scan: scan) { [weak self] res in
            self?.lastSearch = [
                "at": Int(Date().timeIntervalSince1970 * 1000),
                "scan": scan,
                "tried": res.tried.map { $0.json },
                "networks": res.networks.map { ["name": $0.name, "address": $0.address] },
            ]
            done(res)
        }
    }

    private func connect() {
        guard running, conn == nil, !searching else { return }

        // 1. Find the camera if we don't know where it is (or the last place stopped working)
        if target == nil || target?.stale == true {
            searching = true
            search(scan: false) { [weak self] res in
                guard let self = self else { return }
                self.searching = false
                guard self.running else { return }
                if let best = res.found.first(where: { $0.devId != nil }) ?? res.found.first {
                    self.target = Target(host: best.host, port: best.port, proto: best.proto, devId: best.devId)
                    self.saveTarget()
                    self.connect()
                } else {
                    self.lastError = "no camera answered at 192.168.169.1 or on this Wi-Fi"
                    self.retryLater()
                }
            }
            return
        }

        // 2. Connect and log in
        guard let t = target else { return }
        generation += 1
        let gen = generation
        setState(.connecting)
        parser = PacketParser(v2: t.proto == "v2")
        jpeg = JpegAssembler()
        streaming = false

        let tcp = NWProtocolTCP.Options()
        tcp.noDelay = true
        tcp.enableKeepalive = true
        tcp.keepaliveIdle = 5
        tcp.connectionTimeout = 6
        let params = NWParameters(tls: nil, tcp: tcp)
        params.requiredInterfaceType = .wifi
        let c = NWConnection(host: NWEndpoint.Host(t.host), port: NWEndpoint.Port(rawValue: t.port) ?? 6123, using: params)
        conn = c
        c.stateUpdateHandler = { [weak self] st in
            guard let self = self, gen == self.generation else { return }
            switch st {
            case .ready:
                self.handshake(gen)
            case .waiting(let err):
                self.lastError = CameraDiscovery.describe(err)
                self.connectFailed(gen)
            case .failed(let err):
                self.lastError = CameraDiscovery.describe(err)
                self.connectFailed(gen)
            default:
                break
            }
        }
        c.start(queue: .main)
        receive(c, gen)
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self = self, gen == self.generation, self.state == .connecting else { return }
            if self.lastError == nil { self.lastError = "No answer from the camera" }
            self.connectFailed(gen)
        }
    }

    /// Connecting or logging in failed: try the other packet format, then search again.
    private func connectFailed(_ gen: Int) {
        guard gen == generation else { return }
        if state != .connected, var t = target {
            if t.proto == nil { t.proto = "v2" } else { t.stale = true }
            target = t
        }
        drop(gen)
    }

    private func retryLater() {
        setState(.disconnected)
        let delay = backoff
        backoff = min(backoff * 1.6, 8)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self, self.running, self.conn == nil else { return }
            self.connect()
        }
    }

    /// Ends the current connection and schedules a new one.
    private func drop(_ gen: Int) {
        guard gen == generation else { return }
        teardown()
        guard running else { return }
        retryLater()
    }

    private func teardown() {
        generation += 1
        heartbeat?.invalidate()
        heartbeat = nil
        conn?.stateUpdateHandler = nil
        conn?.cancel()
        conn = nil
        streaming = false
        firstPacketHook = nil
        let p = pending
        pending = []
        p.forEach { $0.completion(nil) }
        if let w = xmlWaiter { xmlWaiter = nil; w(nil) }
        if download != nil { finishDownload("The connection to the camera dropped") }
    }

    private func receive(_ c: NWConnection, _ gen: Int) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let self = self, gen == self.generation else { return }
            if let data = data, !data.isEmpty {
                for p in self.parser.push(data) {
                    self.onPacket(p.cmd, p.payload)
                    if gen != self.generation { return }
                }
            }
            if let error = error {
                self.lastError = CameraDiscovery.describe(error)
                self.drop(gen)
                return
            }
            if isComplete {
                self.lastError = "The camera closed the connection"
                self.drop(gen)
                return
            }
            self.receive(c, gen)
        }
    }

    private func send(_ data: Data) {
        conn?.send(content: data, completion: .contentProcessed { _ in })
    }

    private func sendJSON(_ pairs: [(String, JSONValue)]) {
        send(isV2 ? Proto.json2(pairs) : Proto.json(pairs))
    }

    // MARK: - Handshake (the official app's order)

    private func handshake(_ gen: Int) {
        var advanced = false
        let next: (Kind) -> Void = { [weak self] kind in
            guard let self = self, !advanced, gen == self.generation else { return }
            advanced = true
            self.firstPacketHook = nil
            self.login(gen, cameraAskedForId: kind == .live)
        }
        firstPacketHook = next
        if isV2 {
            sendJSON([("code", .int(Code2.liveMotion))])
        } else {
            send(Proto.encode(cmd: Cmd.liveMotion))
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { next(.other) }
    }

    private func login(_ gen: Int, cameraAskedForId: Bool) {
        let loginPairs: [(String, JSONValue)] = [
            ("code", .int(isV2 ? Code2.liveMotion : Code.apConnect)),
            ("target", .string(devTargetId)),
            ("token", .string(devToken)),
            ("unixTimer", .int(localUnixTime())),
        ]
        let afterLogin: ([String: Any]?) -> Void = { [weak self] connResp in
            guard let self = self, gen == self.generation else { return }
            let infoPairs: [(String, JSONValue)] = self.isV2
                ? [("code", .int(Code2.baseInfo))]
                : [("code", .int(Code.baseInfo)), ("unixTimer", .int(localUnixTime()))]
            self.ap(infoPairs) { [weak self] r in
                guard let self = self, gen == self.generation else { return }
                var i = (r?["content"] as? [String: Any]) ?? r ?? [:]
                if i["devId"] == nil, let d = connResp?["devId"] { i["devId"] = d }
                if i["devId"] == nil, let d = self.target?.devId { i["devId"] = d }
                i["protocol"] = self.isV2 ? "v2" : "v1"
                self.info = i
                if self.target?.devId == nil, let d = i["devId"] as? String { self.target?.devId = d; self.saveTarget() }
                if self.target?.proto == nil { self.target?.proto = "v1"; self.saveTarget() }
                self.lastError = nil
                self.backoff = 1
                self.setState(.connected)
                self.heartbeat = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
                    guard let self = self else { return }
                    self.send(self.isV2 ? Proto.encode2(cmd: Cmd2.ping) : Proto.encode(cmd: Cmd.heartbeat))
                }
                self.ap([("code", .int(Code.irLed)), ("IrLed", .int(self.ir ? 1 : 0))]) { _ in }
                if self.flip != 0 { self.ap([("code", .int(Code.videoFlip)), ("mirrorFlip", .int(self.flip))]) { _ in } }
                if self.wantsVideo { self.openStream() }
            }
        }
        if isV2 && !cameraAskedForId {
            afterLogin(nil) // the camera went straight to JSON: no login needed
        } else {
            sendRequest(isV2 ? Proto.json2(loginPairs) : Proto.json(loginPairs), key: isV2 ? Code2.liveMotion : Code.apConnect, timeout: 5, completion: afterLogin)
        }
    }

    // MARK: - Packets

    private func kind(_ cmd: UInt32) -> Kind {
        if isV2 {
            switch cmd {
            case Cmd2.json: return .json
            case Cmd2.jpeg: return .jpeg
            case Cmd2.g711: return .audio
            case Cmd2.xml: return .xml
            case Cmd2.liveMotion: return .live
            case Cmd2.ping: return .ping
            case Cmd2.pong: return .pong
            default: return .other
            }
        }
        switch cmd {
        case UInt32(Cmd.json), UInt32(Cmd.directMotion): return .json
        case UInt32(Cmd.jpeg): return .jpeg
        case UInt32(Cmd.g711): return .audio
        case UInt32(Cmd.xml): return .xml
        case UInt32(Cmd.liveMotion): return .live
        case UInt32(Cmd.heartbeat): return .heartbeat
        case UInt32(Cmd.ping): return .ping
        case UInt32(Cmd.pong): return .pong
        default: return .other
        }
    }

    private func onPacket(_ cmd: UInt32, _ payload: [UInt8]) {
        let k = kind(cmd)
        // Keep-alive: answer the camera's pings, or it drops the connection
        switch k {
        case .heartbeat: send(Proto.encode(cmd: Cmd.heartbeat)); return
        case .ping: send(isV2 ? Proto.encode2(cmd: Cmd2.pong) : Proto.encode(cmd: Cmd.pong)); return
        case .pong: return
        default: break
        }
        if let hook = firstPacketHook, k == .live || k == .json {
            hook(k)
            if k == .live { return }
        }
        if let job = download {
            if k == .json || k == .live {
                if let j = Proto.parseJSON(payload) {
                    if (j["code"] as? NSNumber)?.intValue == Code.sdStreamEnd { finishDownload(nil); return }
                    resolvePending(j)
                }
                return
            }
            if !payload.isEmpty {
                job.handle.write(Data(payload))
                job.bytes += payload.count
                bumpDownload(3)
            }
            return
        }
        switch k {
        case .jpeg:
            for f in jpeg.push(payload) { gotFrame(Data(f)) }
        case .audio:
            gotAudio(Data(payload))
        case .xml:
            if let w = xmlWaiter { xmlWaiter = nil; w(payload) }
        case .json, .live:
            if let j = Proto.parseJSON(payload) { resolvePending(j) }
        default:
            break
        }
    }

    private func resolvePending(_ j: [String: Any]) {
        guard !pending.isEmpty else { return }
        let key = ((j["content"] as? [String: Any])?["code"] as? NSNumber)?.intValue ?? (j["code"] as? NSNumber)?.intValue
        let idx = pending.firstIndex { $0.key != nil && $0.key == key } ?? 0
        let p = pending.remove(at: idx)
        p.completion(j)
    }

    private func gotFrame(_ data: Data) {
        lastFrame = data
        frameSeq += 1
        frameTimestamp = Date().timeIntervalSince1970 * 1000
        lastFrameAt = Date()
        frameTimes.append(frameTimestamp)
        if frameTimes.count > 30 { frameTimes.removeFirst(frameTimes.count - 30) }
        let w = frameWaiters
        frameWaiters = []
        w.forEach { $0() }
    }

    private func gotAudio(_ data: Data) {
        audioSeq += 1
        audioRing.append((seq: audioSeq, data: data))
        if audioRing.count > 40 { audioRing.removeFirst(audioRing.count - 40) }
        let w = audioWaiters
        audioWaiters = []
        w.forEach { $0() }
    }

    func onNextFrame(_ f: @escaping () -> Void) { frameWaiters.append(f) }
    func onNextAudio(_ f: @escaping () -> Void) { audioWaiters.append(f) }

    // MARK: - Requests

    private func request(_ obj: [(String, JSONValue)], timeout: TimeInterval = 4, completion: @escaping ([String: Any]?) -> Void) {
        sendRequest(isV2 ? Proto.json2(obj) : Proto.json(obj), key: Self.key(of: obj), timeout: timeout, completion: completion)
    }

    /// A device command: wrapped in code 502 with the camera's ID for v1, plain JSON for v2.
    private func ap(_ content: [(String, JSONValue)], timeout: TimeInterval = 4, completion: @escaping ([String: Any]?) -> Void) {
        if isV2 {
            request(content, timeout: timeout, completion: completion)
            return
        }
        let target: [(String, JSONValue)] = [("devTarget", .string(devTargetId))]
        let wrapped: [(String, JSONValue)] = [("code", .int(Code.apCommand)), ("content", .object(content + target))]
        sendRequest(Proto.json(wrapped), key: Self.key(of: content), timeout: timeout, completion: completion)
    }

    private static func key(of pairs: [(String, JSONValue)]) -> Int? {
        for (k, v) in pairs where k == "code" { if case .int(let i) = v { return i } }
        return nil
    }

    private func sendRequest(_ data: Data, key: Int?, timeout: TimeInterval, completion: @escaping ([String: Any]?) -> Void) {
        guard conn != nil else { completion(nil); return }
        nextPendingId += 1
        let id = nextPendingId
        pending.append(Pending(id: id, key: key, completion: completion))
        send(data)
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            guard let self = self, let i = self.pending.firstIndex(where: { $0.id == id }) else { return }
            let p = self.pending.remove(at: i)
            p.completion(nil)
        }
    }

    // MARK: - Streaming on demand

    private var wantsVideo: Bool { Date().timeIntervalSince(lastViewerAt) < 20 }

    /// Called whenever the app asks for a frame.
    func viewerPoll() {
        lastViewerAt = Date()
        if state == .connected && !streaming && !busy { openStream() }
    }

    private func openStream() {
        streaming = true
        streamStartedAt = Date()
        if isV2 {
            ap([("code", .int(Code2.avSwitch)), ("avSwitch", .int(3))]) { _ in }
        } else {
            ap([("code", .int(Code.openAV))]) { _ in }
        }
    }

    private func closeStream() {
        streaming = false
        if isV2 {
            ap([("code", .int(Code2.avSwitch)), ("avSwitch", .int(0))]) { _ in }
        } else {
            ap([("code", .int(Code.closeAV))]) { _ in }
        }
    }

    private func watch() {
        guard conn != nil, !busy else { return }
        if streaming {
            let ref = max(lastFrameAt ?? .distantPast, streamStartedAt)
            if Date().timeIntervalSince(ref) > 10 {
                lastError = "Video stopped, reconnecting"
                drop(generation)
                return
            }
            if !wantsVideo { closeStream() }
        }
    }

    var fps: Double {
        guard frameTimes.count > 1, let first = frameTimes.first, let last = frameTimes.last, last > first else { return 0 }
        return (Double(frameTimes.count - 1) * 1000 / (last - first) * 10).rounded() / 10
    }

    func statusJSON() -> [String: Any] {
        var age: Any = NSNull()
        if let t = lastFrameAt { age = Int(Date().timeIntervalSince(t) * 1000) }
        var err: Any = NSNull()
        if let e = lastError { err = e }
        var proto: Any = NSNull()
        if let p = target?.proto { proto = p }
        let settings: [String: Any] = ["ir": ir, "flip": flip]
        var search: Any = NSNull()
        if let s = lastSearch { search = s }
        let host = target?.host ?? CameraDiscovery.defaultHost
        let port = target?.port ?? CameraDiscovery.defaultPort
        return [
            "state": state.rawValue,
            "connected": state == .connected,
            "streaming": streaming,
            "busy": busy,
            "camera": "\(host):\(port)",
            "protocol": proto,
            "info": info,
            "fps": fps,
            "lastFrameAgeMs": age,
            "viewers": wantsVideo ? 1 : 0,
            "settings": settings,
            "lastError": err,
            "search": search,
            "demo": false,
            "native": true,
        ]
    }

    // MARK: - Controls

    private var notConnected: String? { state == .connected && conn != nil ? nil : "The camera is not connected" }
    private var sdUnsupported: String? { isV2 ? "The SD card isn’t supported for this camera model yet" : nil }

    func setIR(_ on: Bool, done: @escaping (String?) -> Void) {
        ir = on
        if let e = notConnected { done(e); return }
        ap([("code", .int(Code.irLed)), ("IrLed", .int(on ? 1 : 0))]) { r in done(r == nil ? "The camera did not respond" : nil) }
    }

    func setFlip(_ mode: Int, done: @escaping (String?) -> Void) {
        flip = mode
        if let e = notConnected { done(e); return }
        ap([("code", .int(Code.videoFlip)), ("mirrorFlip", .int(mode))]) { r in done(r == nil ? "The camera did not respond" : nil) }
    }

    func reboot() {
        if isV2 {
            sendJSON([("code", .int(Code.reboot))])
        } else {
            send(Proto.json([("code", .int(Code.apCommand)), ("content", .object([("code", .int(Code.reboot)), ("devTarget", .string(devTargetId))]))]))
        }
    }

    // MARK: - SD card (v1 cameras)

    func sdStatus(done: @escaping ([String: Any]?, String?) -> Void) {
        if let e = notConnected ?? sdUnsupported { done(nil, e); return }
        ap([("code", .int(Code.sdStatus))]) { r in
            guard let r = r else { done(nil, "The camera did not respond"); return }
            done((r["content"] as? [String: Any]) ?? r, nil)
        }
    }

    func sdDates(done: @escaping ([Int]?, String?) -> Void) {
        if let e = notConnected ?? sdUnsupported { done(nil, e); return }
        request([("code", .int(Code.sdDateList)), ("devTarget", .string(devTargetId))], timeout: 6) { r in
            guard let r = r else { done(nil, "The camera did not respond"); return }
            let raw = (r["dates"] as? [Any]) ?? []
            done(raw.compactMap { ($0 as? NSNumber)?.intValue ?? Int("\($0)") }, nil)
        }
    }

    func sdFiles(date: Int, done: @escaping ([(hour: Int, minute: Int)]?, String?) -> Void) {
        if let e = notConnected ?? sdUnsupported { done(nil, e); return }
        var finished = false
        let finish: ([(hour: Int, minute: Int)]?, String?) -> Void = { files, err in
            if finished { return }
            finished = true
            done(files, err)
        }
        xmlWaiter = { payload in
            guard let payload = payload else { finish(nil, "The camera did not send the file list"); return }
            finish(Proto.parseCatalogue(String(decoding: payload, as: UTF8.self)), nil)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 9) { [weak self] in
            if !finished { self?.xmlWaiter = nil; finish(nil, "The camera did not send the file list") }
        }
        request([("code", .int(Code.sdConfig)), ("devTarget", .string(devTargetId)), ("date", .int(date))], timeout: 6) { [weak self] r in
            guard let r = r else { self?.xmlWaiter = nil; finish(nil, "The camera did not respond"); return }
            if let st = (r["status"] as? NSNumber)?.intValue, st != 200 { self?.xmlWaiter = nil; finish([], nil) }
        }
    }

    /// Downloads one recorded minute (AVI) to a temporary file. Live video pauses meanwhile.
    func sdDownload(date: Int, hour: Int, minute: Int, done: @escaping (URL?, String?) -> Void) {
        if let e = notConnected ?? sdUnsupported { done(nil, e); return }
        if busy { done(nil, "Another download is running"); return }
        let name = "\(date)-" + String(format: "%02ld%02ld", hour, minute) + ".avi"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: url)
        guard FileManager.default.createFile(atPath: url.path, contents: nil),
              let handle = try? FileHandle(forWritingTo: url) else { done(nil, "Couldn’t create the file"); return }
        busy = true
        if streaming { closeStream() }
        let gen = generation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            guard let self = self else { return }
            guard gen == self.generation, self.conn != nil else {
                try? handle.close()
                self.busy = false
                done(nil, "The connection to the camera dropped")
                return
            }
            let job = DownloadJob(url: url, handle: handle, done: done)
            self.download = job
            self.bumpDownload(8)
            self.request([("code", .int(Code.sdStartStream)), ("devTarget", .string(self.devTargetId)), ("date", .int(date)), ("hours", .int(hour)), ("minute", .int(minute))], timeout: 8) { [weak self] r in
                guard let self = self, self.download === job else { return }
                guard let r = r else { self.finishDownload("The camera did not answer"); return }
                if let st = (r["status"] as? NSNumber)?.intValue, st != 200 { self.finishDownload("The camera refused the download (status \(st))") }
            }
        }
    }

    private func bumpDownload(_ seconds: TimeInterval) {
        guard let job = download else { return }
        job.idle?.invalidate()
        job.idle = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in self?.finishDownload(nil) }
    }

    private func finishDownload(_ error: String?) {
        guard let job = download else { return }
        download = nil
        job.idle?.invalidate()
        try? job.handle.close()
        busy = false
        if error == nil && job.bytes > 0 {
            job.done(job.url, nil)
        } else {
            job.done(nil, error ?? "The camera sent no data for this file")
        }
        // A fresh connection is the most reliable way back to live video.
        if conn != nil {
            backoff = 0.5
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.drop(self.generation)
            }
        }
    }
}
