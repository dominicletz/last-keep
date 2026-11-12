defmodule LastKeep.Game.Footprint do
  @moduledoc false

  # priv/footprints.json is written by script/footprints.mjs. The client
  # imports the same file. A body overlaps a polygon when its center is
  # inside the polygon grown by its radius. A step that raises the score is
  # walking out, so a hero who is already inside can leave.

  @path Path.expand("../../../priv/footprints.json", __DIR__)
  @external_resource @path

  @table Jason.decode!(File.read!(@path))
  @axes @table["axes"]
  @ux @axes["ux"] * 1.0
  @uy @axes["uy"] * 1.0
  @vx @axes["vx"] * 1.0
  @vy @axes["vy"] * 1.0
  @kinds @table["kinds"]
  @alias @table["alias"]
  @block MapSet.new(@table["block"])
  @probes @table["probes"]

  def probes, do: @probes

  def blocking?(kind) when is_atom(kind), do: MapSet.member?(@block, Atom.to_string(kind))
  def blocking?(kind) when is_binary(kind), do: MapSet.member?(@block, kind)

  def variant(kind, id \\ 0)

  def variant(kind, id) do
    keys = keys_of(sheet(kind))

    cond do
      keys == [] ->
        "a"

      kind in [:keep, "keep"] ->
        rank = id |> trunc() |> max(0) |> min(length(keys) - 1)
        Enum.at(keys, rank)

      length(keys) == 1 ->
        hd(keys)

      true ->
        n = length(keys)
        Enum.at(keys, Integer.mod(trunc(id), n))
    end
  end

  def gap(kind, variant, x, y) do
    case spec(kind, variant) do
      nil ->
        1.0e9

      poly ->
        {u, v} = local(x, y)

        if inside?(u, v, poly) do
          0.0
        else
          edge_gap(u, v, poly)
        end
    end
  end

  def score(kind, variant, x, y) do
    case spec(kind, variant) do
      nil ->
        1.0e9

      _poly ->
        {u, v} = local(x, y)
        :math.sqrt(u * u + v * v)
    end
  end

  def blocks?(kind, variant, x, y, radius, from \\ nil) do
    if gap(kind, variant, x, y) >= radius do
      false
    else
      case from do
        nil ->
          true

        %{x: fx, y: fy} ->
          score(kind, variant, x, y) <= score(kind, variant, fx, fy) + 1.0e-4
      end
    end
  end

  defp sheet(kind) when is_atom(kind), do: sheet(Atom.to_string(kind))

  defp sheet(kind) when is_binary(kind) do
    Map.get(@alias, kind, kind)
  end

  defp keys_of(name) do
    case Map.get(@kinds, name) do
      nil -> []
      variants -> Map.keys(variants)
    end
  end

  defp spec(kind, variant) do
    name = sheet(kind)

    with variants when is_map(variants) <- Map.get(@kinds, name),
         row when is_map(row) <- Map.get(variants, to_string(variant)),
         poly when is_list(poly) and poly != [] <- row["poly"] do
      Enum.map(poly, fn [u, v] -> {u * 1.0, v * 1.0} end)
    else
      _ -> nil
    end
  end

  defp inside?(u, v, poly) do
    poly
    |> Enum.with_index()
    |> Enum.all?(fn {{ax, ay}, index} ->
      {bx, by} = Enum.at(poly, rem(index + 1, length(poly)))
      (bx - ax) * (v - ay) - (by - ay) * (u - ax) >= -1.0e-6
    end)
  end

  defp local(x, y) do
    {x * @ux + y * @uy, x * @vx + y * @vy}
  end

  defp edge_gap(u, v, poly) do
    poly
    |> Enum.with_index()
    |> Enum.map(fn {{ax, ay}, index} ->
      {bx, by} = Enum.at(poly, rem(index + 1, length(poly)))
      segment_gap(u, v, ax, ay, bx, by)
    end)
    |> Enum.min()
  end

  defp segment_gap(px, py, ax, ay, bx, by) do
    dx = bx - ax
    dy = by - ay
    len2 = dx * dx + dy * dy

    t =
      if len2 < 1.0e-12 do
        0.0
      else
        ((px - ax) * dx + (py - ay) * dy) / len2
      end

    t = t |> max(0.0) |> min(1.0)
    :math.sqrt((px - (ax + dx * t)) ** 2 + (py - (ay + dy * t)) ** 2)
  end
end
