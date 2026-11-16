import Foundation
import Network

/// Finds the camera the way the official V720 app does: connect to TCP port 6123 at a likely address
/// (192.168.169.1 on the camera's own Wi-Fi, the router-style ".1" address of the Wi-Fi the iPhone is on,
/// an address the user typed, or every address of the network on request) and ask "who are you?"
/// (code 114). The camera answers with its devId, in the old (v1) or newer (v2) packet format.
/// Mirrors camera/bridge/discovery.js. Runs on the main queue.
struct ProbeResult {
    let host: String
    let port: UInt16
    let ok: Bool
    var proto: String? = nil
    var devId: String? = nil
    var reason: String? = nil

    var json: [String: Any] {
        var d: [String: Any] = ["host": host, "port": Int(port), "ok": ok]
        d["protocol"] = proto ?? NSNull()
        d["devId"] = devId ?? NSNull()
        d["reason"] = reason ?? NSNull()
        return d
    }
}

enum CameraDiscovery {
    static let defaultHost = "192.168.169.1"
    static let defaultPort: UInt16 = 6123

    // MARK: - One address

    /// Asks one address whether a camera is there (v1 question first, then v2).
    static func probe(host: String, port: UInt16 = defaultPort, done: @escaping (ProbeResult) -> Void) {
        ask(host: host, port: port, question: Proto.encode(cmd: Cmd.directMotion)) { bytes, err in
            if let err = err { done(ProbeResult(host: host, port: port, ok: false, reason: err)); return }
            if let r = parse(bytes, host: host, port: port), r.devId != nil || r.reason == nil { done(r); return }
            let sniffed = Proto.sniff(bytes)
            ask(host: host, port: port, question: Proto.json2([("code", .int(Code2.directMotion))])) { bytes2, err2 in
                if let err2 = err2 { done(ProbeResult(host: host, port: port, ok: false, reason: err2)); return }
                if let r = parse(bytes2, host: host, port: port), r.reason == nil { done(r); return }
                done(ProbeResult(host: host, port: port, ok: true, proto: Proto.sniff(bytes2) ?? sniffed, devId: nil,
                                 reason: "port open, no reply to “who are you?”"))
            }
        }
    }

    /// Returns a result when a JSON answer was found (reason == nil), or a protocol guess (reason set).
    private static func parse(_ bytes: [UInt8], host: String, port: UInt16) -> ProbeResult? {
        guard let proto = Proto.sniff(bytes) else { return nil }
        var parser = PacketParser(v2: proto == "v2")
        let packets = parser.push(Data(bytes))
        for p in packets {
            if let j = Proto.parseJSON(p.payload) {
                let id = (j["devId"] as? String) ?? (j["target"] as? String) ?? (j["devTarget"] as? String)
                return ProbeResult(host: host, port: port, ok: true, proto: proto, devId: id, reason: nil)
            }
        }
        return packets.isEmpty ? nil : ProbeResult(host: host, port: port, ok: true, proto: proto, devId: nil, reason: "no JSON")
    }

    /// Connects, sends `question`, collects whatever arrives for `listen` seconds.
    private static func ask(host: String, port: UInt16, question: Data, connectTimeout: TimeInterval = 1.5,
                            listen: TimeInterval = 1.5, done: @escaping ([UInt8], String?) -> Void) {
        let c = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port) ?? 6123, using: params())
        var finished = false
        var ready = false
        var buf = [UInt8]()
        let finish: (String?) -> Void = { err in
            if finished { return }
            finished = true
            c.stateUpdateHandler = nil
            c.cancel()
            done(buf, err)
        }
        func receive() {
            c.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, isComplete, error in
                if finished { return }
                if let data = data { buf.append(contentsOf: data) }
                if isComplete || error != nil { finish(nil); return }
                receive()
            }
        }
        c.stateUpdateHandler = { st in
            switch st {
            case .ready:
                ready = true
                c.send(content: question, completion: .contentProcessed { _ in })
                receive()
                DispatchQueue.main.asyncAfter(deadline: .now() + listen) { finish(nil) }
            case .waiting(let e), .failed(let e):
                finish(describe(e))
            default:
                break
            }
        }
        c.start(queue: .main)
        DispatchQueue.main.asyncAfter(deadline: .now() + connectTimeout) {
            if !ready { finish("no answer") }
        }
    }

    /// Only checks whether the camera port is open (used to sweep a whole network quickly).
    private static func portOpen(host: String, port: UInt16, timeout: TimeInterval, done: @escaping (Bool) -> Void) {
        let c = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port) ?? 6123, using: params())
        var finished = false
        let finish: (Bool) -> Void = { open in
            if finished { return }
            finished = true
            c.stateUpdateHandler = nil
            c.cancel()
            done(open)
        }
        c.stateUpdateHandler = { st in
            switch st {
            case .ready: finish(true)
            case .waiting, .failed: finish(false)
            default: break
            }
        }
        c.start(queue: .main)
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { finish(false) }
    }

    private static func params() -> NWParameters {
        let tcp = NWProtocolTCP.Options()
        tcp.noDelay = true
        tcp.connectionTimeout = 2
        let p = NWParameters(tls: nil, tcp: tcp)
        p.requiredInterfaceType = .wifi
        return p
    }

    static func describe(_ err: NWError) -> String {
        let text = "\(err)"
        if text.contains("65570") || text.lowercased().contains("policy") {
            return "Local Network access is off for CamControl (Settings → Privacy & Security → Local Network)"
        }
        if case .posix(let code) = err {
            switch code {
            case .ECONNREFUSED: return "something is there, but not a camera port"
            case .ENETUNREACH, .EHOSTUNREACH, .ENETDOWN, .EHOSTDOWN: return "not reachable from this Wi-Fi"
            case .ETIMEDOUT: return "no answer"
            default: break
            }
        }
        return text
    }

    // MARK: - Networks and candidates

    /// IPv4 addresses of this iPhone's Wi-Fi / wired interfaces.
    static func localNetworks() -> [(name: String, address: String)] {
        var out = [(name: String, address: String)]()
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return out }
        defer { freeifaddrs(ifaddr) }
        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let p = ptr {
            let flags = Int32(p.pointee.ifa_flags)
            let name = String(cString: p.pointee.ifa_name)
            if let sa = p.pointee.ifa_addr, sa.pointee.sa_family == UInt8(AF_INET),
               (flags & IFF_UP) != 0, (flags & IFF_LOOPBACK) == 0, name.hasPrefix("en") {
                var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                if getnameinfo(sa, socklen_t(sa.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                    out.append((name: name, address: String(cString: host)))
                }
            }
            ptr = p.pointee.ifa_next
        }
        return out
    }

    private static func prefix(_ address: String) -> String? {
        let parts = address.split(separator: ".")
        guard parts.count == 4 else { return nil }
        return parts[0...2].joined(separator: ".")
    }

    static func quickCandidates(preferred: String?) -> [String] {
        var list = [String]()
        if let p = preferred, !p.isEmpty { list.append(p) }
        list.append(defaultHost)
        for n in localNetworks() { if let pre = prefix(n.address) { list.append("\(pre).1") } }
        var seen = Set<String>()
        return list.filter { seen.insert($0).inserted }
    }

    static func subnetCandidates(excluding: Set<String>) -> [String] {
        var out = [String]()
        var seen = excluding
        for n in localNetworks() {
            guard let pre = prefix(n.address) else { continue }
            for i in 1..<255 {
                let ip = "\(pre).\(i)"
                if ip != n.address && seen.insert(ip).inserted { out.append(ip) }
            }
        }
        return out
    }

    // MARK: - Search

    struct SearchResult {
        var found: [ProbeResult] = []
        var tried: [ProbeResult] = []
        var networks: [(name: String, address: String)] = []
    }

    /// Tries the likely addresses one by one, then (if `scan`) the whole network.
    static func search(preferred: String?, port: UInt16 = defaultPort, scan: Bool, done: @escaping (SearchResult) -> Void) {
        var result = SearchResult()
        result.networks = localNetworks()
        let quick = quickCandidates(preferred: preferred)

        func next(_ i: Int) {
            if i >= quick.count || result.found.contains(where: { $0.devId != nil }) {
                if scan && result.found.isEmpty { sweep() } else { done(result) }
                return
            }
            probe(host: quick[i], port: port) { r in
                result.tried.append(r)
                if r.ok { result.found.append(r) }
                next(i + 1)
            }
        }

        func sweep() {
            let hosts = subnetCandidates(excluding: Set(quick))
            var index = 0
            var running = 0
            var open = [String]()
            func pump() {
                while running < 32 && index < hosts.count {
                    let h = hosts[index]
                    index += 1
                    running += 1
                    portOpen(host: h, port: port, timeout: 0.8) { isOpen in
                        running -= 1
                        if isOpen { open.append(h) }
                        if index >= hosts.count && running == 0 { probeOpen(open, 0) } else { pump() }
                    }
                }
                if hosts.isEmpty { probeOpen([], 0) }
            }
            result.tried.append(ProbeResult(host: "\(hosts.count) addresses on this Wi-Fi", port: port, ok: false,
                                            reason: hosts.isEmpty ? "this iPhone isn’t on a Wi-Fi network" : "checking…"))
            pump()
        }

        func probeOpen(_ list: [String], _ i: Int) {
            if let last = result.tried.indices.last, result.tried[last].reason == "checking…" {
                let summary = result.tried[last]
                result.tried[last] = ProbeResult(host: summary.host, port: port, ok: !list.isEmpty,
                                                 reason: list.isEmpty ? "no camera port found" : "\(list.count) answered")
            }
            if i >= list.count { done(result); return }
            probe(host: list[i], port: port) { r in
                result.tried.append(r)
                if r.ok { result.found.append(r) }
                probeOpen(list, i + 1)
            }
        }

        next(0)
    }
}
