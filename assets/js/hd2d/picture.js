function notImplemented() {
  throw new Error("not implemented")
}

function createHdPicture() {
  return {
    fov: 15,
    ready: new Promise(() => {}),
    open: notImplemented,
    fit: notImplemented,
    seat: notImplemented,
    light: notImplemented,
    dress: notImplemented,
    present: notImplemented
  }
}

export function pictureFromSearch(search) {
  const raw = search && search.startsWith("?") ? search : `?${search || ""}`
  if (new URLSearchParams(raw).get("hd2d") !== "1") return null
  return createHdPicture()
}
