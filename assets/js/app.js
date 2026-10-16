import { bootLanding } from "./landing"
import { bootPlay } from "./play"

const page = document.body.dataset.page

if (page === "home") bootLanding()
if (page === "room") bootPlay(document.body.dataset.code)
