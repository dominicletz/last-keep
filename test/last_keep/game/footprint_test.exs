defmodule LastKeep.Game.FootprintTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.Footprint

  test "the sim gap matches the probes in the shared footprint file" do
    assert length(Footprint.probes()) > 0

    for probe <- Footprint.probes() do
      kind = String.to_existing_atom(probe["kind"])
      variant = probe["variant"]
      gap = Footprint.gap(kind, variant, probe["x"], probe["y"])
      score = Footprint.score(kind, variant, probe["x"], probe["y"])
      assert_in_delta gap, probe["gap"], 0.001
      assert_in_delta score, probe["score"], 0.001
    end
  end

  test "quarry variants follow the sheet order and the keep follows the rank" do
    assert Footprint.variant(:quarry, 0) == "a"
    assert Footprint.variant(:quarry, 1) == "b"
    assert Footprint.variant(:keep, 0) == "0"
    assert Footprint.variant(:keep, 4) == "4"
    assert Footprint.variant(:portal, 0) == "a"
    assert Footprint.blocking?(:house)
    refute Footprint.blocking?(:field)
    refute Footprint.blocking?(:tree)
  end

  test "a hero body on the keep floor overlaps and a step outward does not" do
    assert Footprint.blocks?(:keep, "0", 0, 0, 14)
    assert Footprint.gap(:keep, "0", 200, 0) > 14
    refute Footprint.blocks?(:keep, "0", 200, 0, 14)
    assert Footprint.blocks?(:keep, "0", 0, 0, 14, %{x: -10, y: -10})
    refute Footprint.blocks?(:keep, "0", 40, 40, 14, %{x: 0, y: 0})
  end
end
