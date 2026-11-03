import { bootLanding } from "./landing"
import { loadMonsterSheets } from "./monsters.js"
import { bootPlay } from "./play"

const page = document.body.dataset.page

if (page === "home") bootLanding()
if (page === "room") bootPlay(document.body.dataset.code)

// The monster atlases come as PNGs after the page has loaded. A kind that
// spawns before its sheet arrives is built here instead.
window.addEventListener("load", () => setTimeout(() => loadMonsterSheets(), 0), { once: true })

// Create moves "/" to "/r/CODE" with pushState, and a reload of that entry
// keeps the "/" entry in the same document. Back and forward load the page
// the address names.
window.addEventListener("popstate", () => window.location.reload())
