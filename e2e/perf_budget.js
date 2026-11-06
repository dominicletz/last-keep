// The product target is an iPhone 13 holding 30 fps. 1000/30 ms is that
// frame. CI does not run a phone, so it cannot measure that number.
//
// The runner gate is one low-tier page's present() p95 on ubuntu-24.04
// after compile frames are dropped. Run 41232497345 recorded a quiet-build
// p95 of 6.6 ms on that runner while six pages sat idle, which is an upper
// bound for a single page. The cap is that baseline times 8.
//
// 6.6 * 8 = 52.8 ms. That is above the phone frame (33.3 ms) and below the
// old 424 ms six-page window, so 424 is not raised. A regression back into
// the hundreds of milliseconds still fails. The 691 ms and 741 ms samples
// from that same run were six pages painting at once. They are not a
// single-client frame cost, and they are not this cap.

const iphone13Fps = 30
const iphone13FrameMs = 1000 / iphone13Fps
const runnerBaselineMs = 6.6
const runnerMargin = 8
const retiredWindowMs = 424

function runnerCapMs() {
  return runnerBaselineMs * runnerMargin
}

module.exports = {
  iphone13Fps,
  iphone13FrameMs,
  runnerBaselineMs,
  runnerMargin,
  retiredWindowMs,
  runnerCapMs
}
