import Foundation
import Network

/// Keeps a TCP connection to the camera (its own Wi-Fi hotspot, 192.168.169.1:6123), reconnects when it
/// drops, and streams video only while the app is looking at it. Mirrors camera/bridge/camera.js.
/// Everything runs on the main queue, so no locking is needed.
final class CameraEngine {
    static let shared = CameraEngine()

    enum State: String { case idle, connecting, connected, disconnected }

    let host = "192.168.169.1"
    let port: UInt16 = 6123

    private(set) var state: State = .idle
    private(set) var info: [String: Any] = [:]
    private(set) var lastError: String?
    private(set) var lastFrame: Data?
    private(set) var frameSeq = 0
    private(set) var frameTimestamp: Double = 0 // ms since 1970, when the frame was complete
    private(set) var streaming = false
    private(set) var busy = false
    private(set) var audioSeq = 0
    private(set) var audioRing: [(seq: Int, data: Data)] = []

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
    private var backoff: TimeInterval = 1
    private var parser = PacketParser()
    private var jpeg = JpegAssembler()
    private var pending: [Pending] = []
    private var nextPendingId = 0
    private var firstPacketHook: (() -> Void)?
    private var xmlWaiter: (([UInt8]?) -> Void)?
    private var heartbeat: Timer?
    private var watchdog: Timer?
    private var download: DownloadJob?

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
        if conn != nil { drop(generation) } else if running { connect() }
    }

    private func setState(_ s: State) { state = s }

    private func connect() {
        guard running, conn == nil else { return }
        generation += 1
        let gen = generation
        setState(.connecting)
        parser = PacketParser()
        jpeg = JpegAssembler()
        streaming = false

        let tcp = NWProtocolTCP.Options()
        tcp.noDelay = true
        tcp.enableKeepalive = true
        tcp.keepaliveIdle = 5
        tcp.connectionTimeout = 6
        let params = NWParameters(tls: nil, tcp: tcp)
        params.requiredInterfaceType = .wifi
        let c = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port) ?? 6123, using: params)
        conn = c
        c.stateUpdateHandler = { [weak self] st in
            guard let self = self, gen == self.generation else { return }
            switch st {
            case .ready:
                self.handshake(gen)
            case .waiting(let err):
                self.lastError = Self.describe(err)
                self.drop(gen)
            case .failed(let err):
                self.lastError = Self.describe(err)
                self.drop(gen)
            default:
                break
            }
        }
        c.start(queue: .main)
        receive(c, gen)
        DispatchQueue.main.asyncAfter(deadline: .now() + 9) { [weak self] in
            guard let self = self, gen == self.generation, self.state == .connecting else { return }
            if self.lastError == nil { self.lastError = "No answer from the camera" }
            self.drop(gen)
        }
    }

    private static func describe(_ err: NWError) -> String {
        let text = "\(err)"
        if text.contains("65570") || text.lowercased().contains("policy") {
            return "Local Network access is off for CamControl (Settings → Privacy & Security → Local Network)"
        }
        if case .posix(let code) = err {
            switch code {
            case .ENETUNREACH, .EHOSTUNREACH, .ENETDOWN: return "Not on the camera’s Wi-Fi"
            case .ECONNREFUSED: return "The camera refused the connection"
            case .ETIMEDOUT: return "No answer from the camera"
            default: break
            }
        }
        return text
    }

    /// Ends the current connection and schedules a new one.
    private func drop(_ gen: Int) {
        guard gen == generation else { return }
        teardown()
        guard running else { return }
        setState(.disconnected)
        let delay = backoff
        backoff = min(backoff * 1.6, 8)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self, self.running, self.conn == nil else { return }
            self.connect()
        }
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
                self.lastError = Self.describe(error)
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

    // MARK: - Handshake

    private func handshake(_ gen: Int) {
        var advanced = false
        let next: () -> Void = { [weak self] in
            guard let self = self, !advanced, gen == self.generation else { return }
            advanced = true
            self.firstPacketHook = nil
            self.afterLiveMotion(gen)
        }
        firstPacketHook = next
        send(Proto.encode(cmd: Cmd.liveMotion))
        DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: next)
    }

    private func afterLiveMotion(_ gen: Int) {
        let now = Int(Date().timeIntervalSince1970)
        request([("code", .int(Code.apConnect)), ("target", .string(devTarget)), ("token", .string(devToken)), ("unixTimer", .int(now))]) { [weak self] connResp in
            guard let self = self, gen == self.generation else { return }
            self.ap([("code", .int(Code.baseInfo)), ("unixTimer", .int(now))]) { [weak self] r in
                guard let self = self, gen == self.generation else { return }
                var i = (r?["content"] as? [String: Any]) ?? [:]
                if i["devId"] == nil, let d = connResp?["devId"] { i["devId"] = d }
                self.info = i
                self.lastError = nil
                self.backoff = 1
                self.setState(.connected)
                self.heartbeat = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
                    self?.send(Proto.encode(cmd: Cmd.heartbeat))
                }
                self.ap([("code", .int(Code.irLed)), ("IrLed", .int(self.ir ? 1 : 0))]) { _ in }
                if self.flip != 0 { self.ap([("code", .int(Code.videoFlip)), ("mirrorFlip", .int(self.flip))]) { _ in } }
                if self.wantsVideo { self.openStream() }
            }
        }
    }

    // MARK: - Packets

    private func onPacket(_ cmd: UInt16, _ payload: [UInt8]) {
        if cmd == Cmd.heartbeat {
            send(Proto.encode(cmd: Cmd.heartbeat))
            return
        }
        if let hook = firstPacketHook, cmd == Cmd.liveMotion || cmd == Cmd.json {
            hook()
            if cmd == Cmd.liveMotion { return }
        }
        if let job = download {
            if cmd == Cmd.json || cmd == Cmd.liveMotion {
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
        switch cmd {
        case Cmd.jpeg:
            for f in jpeg.push(payload) { gotFrame(Data(f)) }
        case Cmd.g711:
            gotAudio(Data(payload))
        case Cmd.xml:
            if let w = xmlWaiter { xmlWaiter = nil; w(payload) }
        case Cmd.json, Cmd.liveMotion:
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
        sendRequest(Proto.json(obj), key: Self.key(of: obj), timeout: timeout, completion: completion)
    }

    private func ap(_ content: [(String, JSONValue)], timeout: TimeInterval = 4, completion: @escaping ([String: Any]?) -> Void) {
        sendRequest(Proto.ap(content), key: Self.key(of: content), timeout: timeout, completion: completion)
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
        ap([("code", .int(Code.openAV))]) { _ in }
    }

    private func closeStream() {
        streaming = false
        ap([("code", .int(Code.closeAV))]) { _ in }
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
        let settings: [String: Any] = ["ir": ir, "flip": flip]
        return [
            "state": state.rawValue,
            "connected": state == .connected,
            "streaming": streaming,
            "busy": busy,
            "camera": "\(host):\(port)",
            "info": info,
            "fps": fps,
            "lastFrameAgeMs": age,
            "viewers": wantsVideo ? 1 : 0,
            "settings": settings,
            "lastError": err,
            "demo": false,
            "native": true,
        ]
    }

    // MARK: - Controls

    private var notConnected: String? { state == .connected && conn != nil ? nil : "The camera is not connected" }

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
        send(Proto.ap([("code", .int(Code.reboot))]))
    }

    // MARK: - SD card

    func sdStatus(done: @escaping ([String: Any]?, String?) -> Void) {
        if let e = notConnected { done(nil, e); return }
        ap([("code", .int(Code.sdStatus))]) { r in
            guard let r = r else { done(nil, "The camera did not respond"); return }
            done((r["content"] as? [String: Any]) ?? r, nil)
        }
    }

    func sdDates(done: @escaping ([Int]?, String?) -> Void) {
        if let e = notConnected { done(nil, e); return }
        request([("code", .int(Code.sdDateList)), ("devTarget", .string(devTarget))], timeout: 6) { r in
            guard let r = r else { done(nil, "The camera did not respond"); return }
            let raw = (r["dates"] as? [Any]) ?? []
            done(raw.compactMap { ($0 as? NSNumber)?.intValue ?? Int("\($0)") }, nil)
        }
    }

    func sdFiles(date: Int, done: @escaping ([(hour: Int, minute: Int)]?, String?) -> Void) {
        if let e = notConnected { done(nil, e); return }
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
        request([("code", .int(Code.sdConfig)), ("devTarget", .string(devTarget)), ("date", .int(date))], timeout: 6) { [weak self] r in
            guard let r = r else { self?.xmlWaiter = nil; finish(nil, "The camera did not respond"); return }
            if let st = (r["status"] as? NSNumber)?.intValue, st != 200 { self?.xmlWaiter = nil; finish([], nil) }
        }
    }

    /// Downloads one recorded minute (AVI) to a temporary file. Live video pauses meanwhile.
    func sdDownload(date: Int, hour: Int, minute: Int, done: @escaping (URL?, String?) -> Void) {
        if let e = notConnected { done(nil, e); return }
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
            self.request([("code", .int(Code.sdStartStream)), ("devTarget", .string(devTarget)), ("date", .int(date)), ("hours", .int(hour)), ("minute", .int(minute))], timeout: 8) { [weak self] r in
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
