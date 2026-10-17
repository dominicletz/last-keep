defmodule LastKeep.Game.InteractionsTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.Rules

  @sources [
    "lib/last_keep/game/sim.ex",
    "lib/last_keep/game/rules.ex",
    "lib/last_keep/game/snapshot.ex"
  ]

  setup_all do
    root = File.cwd!()
    doc = root |> Path.join("docs/interactions.json") |> File.read!() |> Jason.decode!()
    source = Enum.map_join(@sources, "\n", &File.read!(Path.join(root, &1)))
    %{doc: doc, source: source}
  end

  test "the six concept monsters are in the graph", %{doc: doc} do
    assert doc["monsters"] == Enum.map(Rules.monsters(), &Atom.to_string/1)

    for kind <- doc["monsters"] do
      assert Enum.any?(doc["edges"], fn edge ->
               edge["from"] == kind and edge["status"] == "implemented"
             end),
             "#{kind} has no implemented edge"
    end
  end

  test "every hero in Rules.heroes/0 is in the graph", %{doc: doc} do
    assert doc["heroes"] == Enum.map(Rules.heroes(), &Atom.to_string/1)
  end

  test "every resource has a producer and a consumer", %{doc: doc} do
    ids = Enum.map(doc["resources"], & &1["id"])
    assert Enum.sort(ids) == ["food", "gold", "wood"]

    for resource <- doc["resources"] do
      assert resource["producers"] != []
      assert resource["consumers"] != []
      assert is_integer(Rules.cap(String.to_existing_atom(resource["id"])))
    end
  end

  test "every building has a cost and a purpose", %{doc: doc} do
    ids = doc["buildings"] |> Enum.map(& &1["id"]) |> Enum.sort()

    assert ids == Rules.builds() |> Enum.map(&Atom.to_string/1) |> Enum.sort()

    for building <- doc["buildings"] do
      assert is_binary(building["purpose"]) and building["purpose"] != ""
      cost = Rules.cost(String.to_existing_atom(building["id"]), :warrior)
      spent = cost.wood + cost.gold + Map.get(cost, :food, 0)
      assert spent > 0
    end
  end

  test "every edge is implemented in source or marked planned", %{doc: doc, source: source} do
    for edge <- doc["edges"] do
      assert edge["from"] != ""
      assert edge["to"] != ""
      assert edge["via"] != ""
      assert edge["status"] in ["implemented", "planned"]

      case edge["status"] do
        "implemented" ->
          rule = edge["rule"]
          assert is_binary(rule) and rule != ""

          assert String.contains?(source, rule),
                 "missing #{rule} for #{edge["from"]} -> #{edge["to"]}"

        "planned" ->
          :ok
      end
    end
  end

  test "every hero has an implemented outgoing edge", %{doc: doc} do
    for hero <- doc["heroes"] do
      assert Enum.any?(doc["edges"], fn edge ->
               edge["from"] == hero and edge["status"] == "implemented"
             end),
             "#{hero} has no implemented outgoing edge"
    end
  end
end
