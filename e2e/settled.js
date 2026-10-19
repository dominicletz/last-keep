function roleCount(sample, role) {
  return sample.census?.byRole?.[role] || 0
}

// A chest or a portal found between two quiet builds is one mesh and one
// snapshot row. The settled rise may not pass the rise in those rows. A mesh
// that does not match its row is a leak, including a chest that stays after
// the snapshot drops it. A wall, a hero, or a tree is not in that allowance.
function settledHolds(first, later) {
  for (const sample of [first, later]) {
    if (roleCount(sample, "chest") !== sample.chests) return false
    if (roleCount(sample, "portal") !== sample.portals) return false
  }
  const extra = later.chests + later.portals - (first.chests + first.portals)
  const delta = later.census.settled - first.census.settled
  return delta <= extra
}

module.exports = { settledHolds }
