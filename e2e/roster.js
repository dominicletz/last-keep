function rosterReady(seats, names) {
  if (!Array.isArray(seats) || !Array.isArray(names)) return false
  return names.every((name) => seats.some((seat) => seat && seat.name === name && seat.connected === true))
}

function joinTogether(start, party) {
  return Promise.all(party.map((seat) => start(seat)))
}

module.exports = { rosterReady, joinTogether }
