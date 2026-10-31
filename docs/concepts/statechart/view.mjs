const session = {
  door: "Choosing a hero",
  lobby: "Waiting for the host",
  day: "Day",
  night: "The night",
  frenzy: "Frenzied",
  fallen: "The keep has fallen",
  closed: "The room is closed",
}

const you = {
  out: "Not in the yard",
  ring: "On the ring",
  keep: "At the keep",
  down: "Down",
  told: "Told to walk to the keep",
}

const table = {
  none: "Just the host",
  here: "A friend is here",
  left: "A friend left",
}

export const title = "Last Keep"

export const colors = {
  Outside: "tan",
  Waiting: "yellow",
  Day: "blue",
  Night: "purple",
  Fallen: "pink",
}

export const group = (v) => {
  if (v.screen === "door" || v.screen === "closed") return "Outside"
  if (v.screen === "lobby") return "Waiting"
  if (v.screen === "day") return "Day"
  if (v.screen === "night" || v.screen === "frenzy") return "Night"
  if (v.screen === "fallen") return "Fallen"
  return "Outside"
}

export const state = (v) => ({
  Session: session[v.screen],
  You: you[v.place],
  Table: v.screen === "door" || v.screen === "closed" ? "No table" : table[v.friend],
  Keep: v.screen === "door" || v.screen === "closed" ? "No keep" : v.rank >= 1 ? "As high as it goes" : "Can still rise",
})

const label = {
  YouSitDown: "you sit down",
  TheHostStarts: "the host starts the night",
  AFriendPressesStart: null,
  YouWalkToTheKeep: "you walk to the keep",
  YouWalkOffTheKeep: "you walk off the keep",
  ThePurseFills: null,
  YouRaiseTheKeep: "you raise the keep",
  YouTryToRaiseFromTheRing: "you try to raise the keep",
  AMonsterDownsYou: "a monster downs you",
  YouStandBackUp: "you stand back up on the ring",
  TheHornSounds: "the horn sounds",
  TheNightRunsLong: "the night runs long",
  TheNightClears: "the night clears",
  TheKeepFalls: "the keep falls",
  YouPressNewKeep: "you press New keep",
  TheSocketRestarts: "a connected page sends restart",
  AFriendSitsDown: "a friend sits down",
  AFriendLeaves: "a friend leaves",
  AFriendComesBack: "a friend comes back",
  YouLeave: "you leave",
  YouComeBack: "you come back",
  TheRoomCloses: "the room closes",
  Done: null,
}

export const step = (action, from) => {
  if (action === "TheRoomCloses" && from.screen !== "lobby") return null
  return label[action]
}
