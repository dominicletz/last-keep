import { mountStart } from "./start"

const storageKey = "lastkeep-name"

export function bootLanding() {
  const form = document.querySelector("#start-screen")
  const stage = document.querySelector("#stage")
  const error = form.querySelector("#start-error")
  let token = null

  mountStart({
    stage,
    form,
    mode: "create",
    onAccept: async (pick) => {
      error.hidden = true
      token = token || crypto.randomUUID().replaceAll("-", "")
      try {
        const response = await fetch("/api/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: pick.name, hero: pick.hero, token })
        })
        const body = await response.json()
        if (!response.ok) {
          error.hidden = false
          error.textContent = body.error || "Could not create the game."
          return
        }
        const stored = { token: body.token, name: pick.name, hero: pick.hero }
        localStorage.setItem(storageKey, pick.name)
        localStorage.setItem("lastkeep-hero", pick.hero)
        localStorage.setItem(`lastkeep:${body.code}`, JSON.stringify(stored))
        window.location = body.path
      } catch (_err) {
        error.hidden = false
        error.textContent = "The keep did not answer."
      }
    }
  })

  loadScores()
}

export async function loadScores(target) {
  const list = target || document.querySelector("#score-list")
  if (!list) return
  try {
    const response = await fetch("/api/highscores")
    const body = await response.json()
    const scores = body.scores || []
    if (scores.length === 0) {
      list.innerHTML = '<li class="empty">No keeps have fallen yet.</li>'
      return
    }
    list.innerHTML = scores
      .map((row) => {
        const names = (row.names || []).join(", ")
        return `<li><b>${row.score}</b> <span>wave ${row.wave} · ${row.kills} kills</span> <em>${escapeHtml(names)}</em></li>`
      })
      .join("")
  } catch (_err) {
    list.innerHTML = '<li class="empty">Scores are quiet.</li>'
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}
