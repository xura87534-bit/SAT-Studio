#!/usr/bin/env python3
"""
CamControl check-up: shows what this Mac can see of a V720 / Naxclow mini camera,
over Wi-Fi and over USB. It only reads and asks questions; it changes nothing.

Run it on the Mac while the Mac is joined to the camera's Wi-Fi (Nax_... / MC-...),
with the camera plugged in by USB if you like:

    curl -sL https://raw.githubusercontent.com/xura87534-bit/SAT-Studio/claude/wifi-camera-control-radar-o08jk0/camera/tools/diagnose.py | python3 -

Then copy everything it prints and send it back.
Options for testing: --host 1.2.3.4 (extra address) --port 6123 --listen 6 (seconds to listen for broadcasts)
"""

import json
import os
import platform
import re
import socket
import struct
import subprocess
import sys
import time

CAMERA_PORT = 6123
OTHER_PORTS = [80, 554, 8080, 8554, 23, 8000, 34567, 5000, 7000, 6000, 8888]
BROADCAST_PORT = 11400  # the official app listens here for camera broadcasts


def args():
    a = {"hosts": [], "port": CAMERA_PORT, "listen": 6}
    argv = sys.argv[1:]
    i = 0
    while i < len(argv):
        if argv[i] == "--host":
            a["hosts"].append(argv[i + 1]); i += 1
        elif argv[i] == "--port":
            a["port"] = int(argv[i + 1]); i += 1
        elif argv[i] == "--listen":
            a["listen"] = float(argv[i + 1]); i += 1
        i += 1
    return a


def run(cmd, timeout=8):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout.strip()
    except Exception as e:  # command missing (e.g. not a Mac) or timed out
        return f"({cmd[0]}: {e.__class__.__name__})"


def section(title):
    print()
    print("=" * 64)
    print(title)
    print("=" * 64)


# --- the camera's packet formats (same as camera/bridge/protocol.js) ---------------------------

def v1_packet(cmd, payload=b""):
    return struct.pack("<IHBB8sI", len(payload), cmd, 0, 0, b"00000000", 0) + payload


def v2_packet(cmd, payload=b""):
    return struct.pack("<III8s", len(payload), cmd, 0, b"\0" * 8) + payload


def describe_reply(buf):
    if not buf:
        return "no reply"
    out = [f"{len(buf)} bytes, first 64 in hex: {buf[:64].hex(' ')}"]
    pos = 0
    while len(buf) - pos >= 20 and len(out) < 8:
        ln = struct.unpack_from("<I", buf, pos)[0]
        fwd = buf[pos + 8:pos + 16]
        fmt = "v1" if all(48 <= b <= 57 or 65 <= b <= 90 or 97 <= b <= 122 for b in fwd) else "v2"
        cmd = struct.unpack_from("<H", buf, pos + 4)[0] if fmt == "v1" else struct.unpack_from("<I", buf, pos + 4)[0]
        body = buf[pos + 20:pos + 20 + min(ln, 600)]
        text = body.decode("utf-8", "replace").rstrip("\0")
        shown = text if text.startswith("{") or text.startswith("<") else f"{len(body)} bytes of data"
        out.append(f"  packet ({fmt}) cmd={cmd} length={ln}: {shown}")
        if ln > 4_000_000:
            break
        pos += 20 + ln
    return "\n".join(out)


def ask_tcp(host, port, question, wait=2.0):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2)
    try:
        s.connect((host, port))
    except Exception as e:
        return None, f"cannot connect ({e.__class__.__name__}: {e})"
    data = b""
    try:
        s.sendall(question)
        s.settimeout(0.3)
        end = time.time() + wait
        while time.time() < end:
            try:
                chunk = s.recv(65536)
                if not chunk:
                    break
                data += chunk
            except socket.timeout:
                pass
    finally:
        s.close()
    return data, None


def port_open(host, port, timeout=0.8):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((host, port))
        return True
    except Exception:
        return False
    finally:
        s.close()


# --- network facts ------------------------------------------------------------------------------

def local_ipv4():
    out = []
    text = run(["ifconfig"])
    name = None
    for line in text.splitlines():
        m = re.match(r"^(\S+?):", line)
        if m:
            name = m.group(1)
        m = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", line)
        if m and not m.group(1).startswith("127.") and name:
            out.append((name, m.group(1)))
    if not out:  # not macOS: fall back to the outgoing address
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("192.168.169.1", 9))
            out.append(("default", s.getsockname()[0]))
            s.close()
        except Exception:
            pass
    return out


def main():
    a = args()
    port = a["port"]
    print("CamControl camera check-up", time.strftime("%Y-%m-%d %H:%M"))
    print("System:", platform.platform())

    section("1. Wi-Fi")
    wifi = run(["networksetup", "-getairportnetwork", "en0"])
    print("Wi-Fi network:", wifi)
    summary = run(["ipconfig", "getsummary", "en0"])
    m = re.search(r"\bSSID : (.+)", summary)
    if m:
        print("Wi-Fi network (summary):", m.group(1).strip())
    ips = local_ipv4()
    for n, ip in ips:
        print(f"This Mac's address on {n}: {ip}")
    gw = run(["route", "-n", "get", "default"])
    gwm = re.search(r"gateway: (\S+)", gw)
    gateway = gwm.group(1) if gwm else None
    print("Router / gateway:", gateway or "(none found)")
    on_cam_wifi = any(ip.startswith("192.168.169.") for _, ip in ips)
    print("On a camera hotspot (192.168.169.x)?", "YES" if on_cam_wifi else "no")

    section("2. Devices this Mac has seen on the network (arp)")
    arp = run(["arp", "-an"])
    print(arp or "(none)")
    arp_ips = re.findall(r"\((\d+\.\d+\.\d+\.\d+)\) at ([0-9a-f:]+)", arp)

    candidates = list(dict.fromkeys(a["hosts"] + ["192.168.169.1"] + ([gateway] if gateway else []) + [ip for ip, mac in arp_ips if not ip.endswith(".255")]))
    candidates = [c for c in candidates if c and not c.startswith("224.") and c not in [ip for _, ip in ips]]

    section("3. Knocking on likely addresses")
    cameras = []
    for host in candidates:
        ping = run(["ping", "-c", "1", "-t", "1", host], timeout=4)
        alive = "1 packets received" in ping or "1 received" in ping
        open_ports = [p for p in [port] + OTHER_PORTS if port_open(host, p)]
        print(f"{host}: ping {'answers' if alive else 'no answer'}; open ports: {open_ports or 'none'}")
        if port in open_ports:
            cameras.append(host)

    section(f"4. Asking 'who are you?' on port {port}")
    if not cameras:
        print(f"No address has the camera port {port} open.")
    for host in cameras:
        for label, q in [
            ("v1 'who are you?' (cmd 114)", v1_packet(114)),
            ("v1 'start' (cmd 115)", v1_packet(115)),
            ("v2 'who are you?' JSON code 114", v2_packet(8, b'{"code":114}')),
            ("v2 'start' JSON code 115", v2_packet(8, b'{"code":115}')),
        ]:
            data, err = ask_tcp(host, port, q)
            print(f"{host} <- {label}:")
            print("  " + (err or describe_reply(data)).replace("\n", "\n  "))

    section("5. UDP: asking and listening for camera broadcasts")
    for host in candidates[:4]:
        try:
            u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            u.settimeout(1.5)
            u.sendto(v1_packet(114), (host, port))
            data, sender = u.recvfrom(4096)
            print(f"UDP {host}:{port} answered from {sender}:\n  " + describe_reply(data).replace("\n", "\n  "))
        except Exception as e:
            print(f"UDP {host}:{port}: no answer ({e.__class__.__name__})")
        finally:
            u.close()
    try:
        b = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        b.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        b.bind(("", BROADCAST_PORT))
        b.settimeout(0.5)
        print(f"Listening {a['listen']:.0f} s on UDP {BROADCAST_PORT} for camera broadcasts...")
        end = time.time() + a["listen"]
        got = 0
        while time.time() < end:
            try:
                data, sender = b.recvfrom(4096)
                got += 1
                print(f"  from {sender}: {data[:300]!r}")
            except socket.timeout:
                pass
        if not got:
            print("  nothing heard")
        b.close()
    except Exception as e:
        print(f"Could not listen on UDP {BROADCAST_PORT}: {e}")

    section("6. USB: is the camera plugged in?")
    usb = run(["system_profiler", "SPUSBDataType", "SPUSBHostDataType"], timeout=20)
    interesting = []
    for line in usb.splitlines():
        if re.search(r"(Product ID|Vendor ID|Manufacturer|Serial Number|Speed|^\s{4,8}\S.*:$)", line):
            interesting.append(line.rstrip())
    print("\n".join(interesting[:80]) or usb[:3000] or "(no USB information)")
    cams = run(["system_profiler", "SPCameraDataType"], timeout=15)
    print("\nCameras macOS sees (webcams):")
    print(cams or "(none)")
    print("\nDrives:")
    try:
        vols = [v for v in os.listdir("/Volumes") if v not in ("Macintosh HD", "Macintosh HD - Data", "Recovery")]
    except Exception:
        vols = []
    if not vols:
        print("  no extra drives (with a memory card inside, the camera often shows up as a drive)")
    for v in vols:
        path = os.path.join("/Volumes", v)
        print(f"  {path}")
        try:
            for root, dirs, files in os.walk(path):
                depth = root[len(path):].count(os.sep)
                if depth > 2:
                    dirs[:] = []
                    continue
                dirs[:] = [d for d in dirs if not d.startswith(".")][:20]
                for f in sorted(files)[:15]:
                    full = os.path.join(root, f)
                    size = os.path.getsize(full)
                    print(f"    {full[len(path):]}  ({size} bytes)")
                    if f.lower().endswith((".txt", ".ini", ".cfg", ".conf", ".json", ".xml")) and size < 4000:
                        with open(full, "r", errors="replace") as fh:
                            print("      | " + fh.read().strip().replace("\n", "\n      | "))
        except Exception as e:
            print(f"    could not read: {e}")

    section("Summary")
    if cameras:
        print(f"Camera port {port} is open at: {', '.join(cameras)}. See part 4 for how it answered.")
    elif on_cam_wifi:
        print("The Mac is on a camera hotspot, but nothing opened the camera port.")
    else:
        print("The Mac is not on a camera hotspot (192.168.169.x) and no camera port was found.")
    print("Copy everything above and send it back.")


if __name__ == "__main__":
    main()
