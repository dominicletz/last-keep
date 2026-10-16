defmodule LastKeep.Game.Waves do
  @moduledoc false

  def plan(wave, rng) when wave >= 1 do
    {angle, rng} = angle(rng)
    elite = elite(wave)

    groups =
      if elite == :boss do
        boss = %{angle: angle, kind: :boss, count: 1, elite: :boss}

        adds =
          for i <- 1..min(2 + div(wave, 5), 4) do
            %{
              angle: angle + i * 1.35,
              kind: add_kind(wave, i),
              count: 2 + div(wave, 4),
              elite: nil
            }
          end

        [boss | adds]
      else
        dirs = min(2 + div(wave - 1, 2), 6)

        for i <- 0..(dirs - 1) do
          kind = kind_for(wave, i)

          %{
            angle: angle + i * 2 * :math.pi() / dirs,
            kind: kind,
            count: count_for(wave, kind),
            elite: elite
          }
        end
      end

    {groups, rng}
  end

  def elite(wave) when rem(wave, 10) == 0, do: :boss

  def elite(wave) when rem(wave, 5) == 0 do
    case rem(div(wave, 5), 3) do
      1 -> :fast
      2 -> :armored
      _ -> :enraged
    end
  end

  def elite(_wave), do: nil

  defp kind_for(wave, i) do
    cond do
      wave >= 4 and rem(i, 4) == 3 -> :troll
      wave >= 3 and rem(i, 3) == 2 -> :wolf
      wave >= 2 and rem(i, 2) == 1 -> :skeleton
      true -> :goblin
    end
  end

  defp add_kind(wave, i) do
    cond do
      wave >= 10 and rem(i, 2) == 0 -> :wolf
      wave >= 5 -> :skeleton
      true -> :goblin
    end
  end

  defp count_for(wave, :troll), do: 1 + div(wave, 7)
  defp count_for(wave, :wolf), do: 2 + div(wave, 3)
  defp count_for(wave, :skeleton), do: 2 + div(wave, 2)
  defp count_for(wave, :goblin), do: 3 + div(wave, 2)

  defp angle(rng) do
    {u, rng} = :rand.uniform_s(rng)
    {u * 2 * :math.pi(), rng}
  end
end
