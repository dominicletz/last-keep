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

  @keys Map.new(@kinds, fn {name, variants} ->
          {name, variants |> Map.keys() |> Enum.sort()}
        end)

  @edges Map.new(@kinds, fn {name, variants} ->
           by_variant =
             Map.new(variants, fn {variant, row} ->
               edges =
                 case row["poly"] do
                   poly when is_list(poly) and poly != [] ->
                     pts = Enum.map(poly, fn [u, v] -> {u * 1.0, v * 1.0} end)

                     Enum.zip(pts, tl(pts) ++ [hd(pts)])
                     |> Enum.map(fn {{ax, ay}, {bx, by}} -> {ax, ay, bx, by} end)

                   _ ->
                     nil
                 end

               {variant, edges}
             end)

           {name, by_variant}
         end)

  def probes, do: @probes

  def blocking?(kind) when is_atom(kind), do: MapSet.member?(@block, Atom.to_string(kind))
  def blocking?(kind) when is_binary(kind), do: MapSet.member?(@block, kind)

  def variant(kind, id \\ 0)

  def variant(kind, id) do
    keys = Map.get(@keys, sheet(kind), [])

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
    case edges_for(kind, variant) do
      nil ->
        1.0e9

      edges ->
        {u, v} = local(x, y)
        edges_gap(u, v, edges)
    end
  end

  def score(kind, variant, x, y) do
    case edges_for(kind, variant) do
      nil ->
        1.0e9

      _edges ->
        {u, v} = local(x, y)
        :math.sqrt(u * u + v * v)
    end
  end

  def blocks?(kind, variant, x, y, radius, from \\ nil) do
    case edges_for(kind, variant) do
      nil ->
        false

      edges ->
        {u, v} = local(x, y)

        if edges_gap(u, v, edges) >= radius do
          false
        else
          case from do
            nil ->
              true

            %{x: fx, y: fy} ->
              {fu, fv} = local(fx, fy)
              :math.sqrt(u * u + v * v) <= :math.sqrt(fu * fu + fv * fv) + 1.0e-4
          end
        end
    end
  end

  defp sheet(kind) when is_atom(kind), do: sheet(Atom.to_string(kind))

  defp sheet(kind) when is_binary(kind) do
    Map.get(@alias, kind, kind)
  end

  defp edges_for(kind, variant) do
    case Map.get(@edges, sheet(kind)) do
      variants when is_map(variants) -> Map.get(variants, to_string(variant))
      _ -> nil
    end
  end

  defp edges_gap(u, v, edges) do
    if inside?(u, v, edges), do: 0.0, else: min_edge_gap(u, v, edges, 1.0e9)
  end

  defp inside?(_u, _v, []), do: true

  defp inside?(u, v, [{ax, ay, bx, by} | rest]) do
    if (bx - ax) * (v - ay) - (by - ay) * (u - ax) >= -1.0e-6 do
      inside?(u, v, rest)
    else
      false
    end
  end

  defp min_edge_gap(_u, _v, [], best), do: best

  defp min_edge_gap(u, v, [{ax, ay, bx, by} | rest], best) do
    d = segment_gap(u, v, ax, ay, bx, by)
    min_edge_gap(u, v, rest, if(d < best, do: d, else: best))
  end

  defp local(x, y) do
    {x * @ux + y * @uy, x * @vx + y * @vy}
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
