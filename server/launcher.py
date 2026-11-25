"""TourMaker.exe entry point: runs the server in a thread and shows it in a desktop window."""
import socket
import sys
import threading
import time
import urllib.request
import webbrowser

import uvicorn

import tour_server


def free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_ready(url: str, timeout: float = 30.0) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        try:
            with urllib.request.urlopen(url + "/api/health", timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.25)
    return False


def main() -> None:
    port = free_port()
    app = tour_server.create_app(None, "exe")
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
    threading.Thread(target=server.run, daemon=True).start()
    url = f"http://127.0.0.1:{port}"
    if not wait_ready(url):
        print("Server did not start", file=sys.stderr)
        sys.exit(1)
    try:
        import webview  # pywebview
        webview.create_window("Day Tour Video Maker", url, width=430, height=900, resizable=True)
        webview.start()
    except Exception as e:  # no pywebview / no GUI backend: use the browser instead
        print(f"[tour] desktop window unavailable ({e}); opening browser at {url}")
        webbrowser.open(url)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            pass
    server.should_exit = True


if __name__ == "__main__":
    main()
