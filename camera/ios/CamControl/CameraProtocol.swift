import Foundation

// Wire protocol of V720 / Naxclow cameras. Same as camera/bridge/protocol.js.
//
// Every message is a 20-byte little-endian header followed by a payload:
//   uint32 payloadLength, uint16 cmd, uint8 msgFlag, uint8 dealFlag, char[8] forwardId ("00000000"), uint32 pkgId
//
// Reverse-engineered by the open-source a9-v720 project (https://github.com/intx82/a9-v720).

enum Cmd {
    static let json: UInt16 = 0
    static let jpeg: UInt16 = 1
    static let g711: UInt16 = 4
    static let avi: UInt16 = 7
    static let xml: UInt16 = 8
    static let heartbeat: UInt16 = 100
    static let liveMotion: UInt16 = 115
}

enum Code {
    static let apConnect = 501
    static let apCommand = 502
    static let closeAV = 0
    static let openAV = 3
    static let baseInfo = 4
    static let irLed = 202
    static let videoFlip = 216
    static let sdStatus = 218
    static let reboot = 299
    static let sdDateList = 400
    static let sdConfig = 402
    static let sdStartStream = 406
    static let sdStreamEnd = 411
}

let devTarget = "deadbeef"
let devToken = "This is TEST token"

/// A tiny JSON value that keeps key order ("code" first, like the original app sends it).
indirect enum JSONValue {
    case int(Int)
    case string(String)
    case object([(String, JSONValue)])

    var encoded: String {
        switch self {
        case .int(let i):
            return String(i)
        case .string(let s):
            var out = "\""
            for u in s.unicodeScalars {
                switch u {
                case "\"": out += "\\\""
                case "\\": out += "\\\\"
                case "\n": out += "\\n"
                case "\r": out += "\\r"
                case "\t": out += "\\t"
                default:
                    if u.value < 0x20 || u.value > 0x7e {
                        if u.value > 0xffff {
                            // surrogate pair
                            let v = u.value - 0x10000
                            out += String(format: "\\u%04x\\u%04x", 0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff))
                        } else {
                            out += String(format: "\\u%04x", u.value)
                        }
                    } else {
                        out.unicodeScalars.append(u)
                    }
                }
            }
            return out + "\""
        case .object(let pairs):
            return "{" + pairs.map { JSONValue.string($0.0).encoded + ":" + $0.1.encoded }.joined(separator: ",") + "}"
        }
    }
}

enum Proto {
    static func encode(cmd: UInt16, payload: [UInt8] = []) -> Data {
        var d = [UInt8]()
        d.reserveCapacity(20 + payload.count)
        let len = UInt32(payload.count)
        d.append(UInt8(len & 0xff))
        d.append(UInt8((len >> 8) & 0xff))
        d.append(UInt8((len >> 16) & 0xff))
        d.append(UInt8((len >> 24) & 0xff))
        d.append(UInt8(cmd & 0xff))
        d.append(UInt8((cmd >> 8) & 0xff))
        d.append(0) // msgFlag
        d.append(0) // dealFlag
        d.append(contentsOf: Array("00000000".utf8))
        d.append(contentsOf: [0, 0, 0, 0]) // pkgId
        d.append(contentsOf: payload)
        return Data(d)
    }

    static func json(_ pairs: [(String, JSONValue)]) -> Data {
        encode(cmd: Cmd.json, payload: Array(JSONValue.object(pairs).encoded.utf8))
    }

    /// A command sent through the camera's AP command channel (code 502).
    static func ap(_ content: [(String, JSONValue)]) -> Data {
        let target: [(String, JSONValue)] = [("devTarget", .string(devTarget))]
        return json([("code", .int(Code.apCommand)), ("content", .object(content + target))])
    }

    static func parseJSON(_ payload: [UInt8]) -> [String: Any]? {
        var bytes = payload
        while let last = bytes.last, last == 0 { bytes.removeLast() }
        guard !bytes.isEmpty else { return nil }
        return (try? JSONSerialization.jsonObject(with: Data(bytes))) as? [String: Any]
    }

    /// Parses <option hours="9" minBin="96"/> entries of the SD card catalogue into (hour, minute) pairs.
    static func parseCatalogue(_ xml: String) -> [(hour: Int, minute: Int)] {
        guard let re = try? NSRegularExpression(pattern: "<option\\b[^>]*?hours=\"(\\d+)\"[^>]*?minBin=\"(\\d+)\"") else { return [] }
        var out = [(hour: Int, minute: Int)]()
        let ns = xml as NSString
        for m in re.matches(in: xml, range: NSRange(location: 0, length: ns.length)) {
            guard let hour = Int(ns.substring(with: m.range(at: 1))),
                  let mask = UInt64(ns.substring(with: m.range(at: 2))) else { continue }
            for bit in 0..<64 where (mask >> UInt64(bit)) & 1 == 1 {
                out.append((hour: hour, minute: bit))
            }
        }
        return out
    }
}

/// Incremental parser: feed it TCP chunks, get whole packets back.
struct PacketParser {
    private var buf = [UInt8]()

    mutating func push(_ data: Data) -> [(cmd: UInt16, payload: [UInt8])] {
        buf.append(contentsOf: data)
        var out = [(cmd: UInt16, payload: [UInt8])]()
        var pos = 0
        while buf.count - pos >= 20 {
            let len = Int(buf[pos]) | (Int(buf[pos + 1]) << 8) | (Int(buf[pos + 2]) << 16) | (Int(buf[pos + 3]) << 24)
            if len > 4_000_000 { // lost sync
                buf.removeAll()
                return out
            }
            if buf.count - pos < 20 + len { break }
            let cmd = UInt16(buf[pos + 4]) | (UInt16(buf[pos + 5]) << 8)
            out.append((cmd: cmd, payload: Array(buf[(pos + 20)..<(pos + 20 + len)])))
            pos += 20 + len
        }
        if pos > 0 { buf.removeFirst(pos) }
        return out
    }
}

/// Re-assembles JPEG pictures (FF D8 … FF D9) from the camera's JPEG chunks.
struct JpegAssembler {
    private var frame = [UInt8]()
    private var inFrame = false

    mutating func push(_ data: [UInt8]) -> [[UInt8]] {
        var out = [[UInt8]]()
        var i = 0
        let n = data.count
        while i < n {
            if !inFrame {
                var found = -1
                var j = i
                while j + 1 < n {
                    if data[j] == 0xff && data[j + 1] == 0xd8 { found = j; break }
                    j += 1
                }
                if found < 0 { return out }
                inFrame = true
                frame.removeAll(keepingCapacity: true)
                frame.append(0xff)
                frame.append(0xd8)
                i = found + 2
                continue
            }
            let b = data[i]
            frame.append(b)
            i += 1
            if b == 0xd9 && frame.count >= 4 && frame[frame.count - 2] == 0xff {
                out.append(frame)
                inFrame = false
                frame.removeAll(keepingCapacity: true)
            } else if frame.count > 4_000_000 {
                inFrame = false
                frame.removeAll()
            }
        }
        return out
    }
}
