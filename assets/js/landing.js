const storageKey = "lastkeep-name"

export function bootLanding() {
  const form = document.querySelector("#create-game")
  const name = document.querySelector("#player-name")
  const error = document.querySelector("#create-error")
  name.value = localStorage.getItem(storageKey) || ""

  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    error.hidden = true
    const hero = form.querySelector("input[name=hero]:checked").value
    const token = crypto.randomUUID().replaceAll("-", "")

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.value, hero, token })
      })
      const body = await response.json()
      if (!response.ok) {
        error.hidden = false
        error.textContent = body.error || "Could not create the game."
        return
      }
      localStorage.setItem(storageKey, name.value.trim())
      localStorage.setItem(`lastkeep:${body.code}`, JSON.stringify({ token: body.token, name: name.value.trim(), hero }))
      window.location = body.path
    } catch (_err) {
      error.hidden = false
      error.textContent = "The keep did not answer."
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
