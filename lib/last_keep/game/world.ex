defmodule LastKeep.Game.World do
  @moduledoc false

  def generate(_seed) do
    %{seed: 0, attempt: 0, radius: 0, chunk_size: 0, chunks: %{}, pois: []}
  end

  def chunk(_seed, _cx, _cy), do: %{cells: %{}}
end
