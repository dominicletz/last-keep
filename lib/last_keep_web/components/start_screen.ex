defmodule LastKeepWeb.StartScreen do
  @moduledoc false
  use Phoenix.Component

  attr :mode, :string, required: true
  attr :hidden, :boolean, default: false

  def start_screen(assigns) do
    ~H"""
    <form id="start-screen" data-hero="warrior" hidden={@hidden}>
      <p class="start-title">Last Keep</p>
      <button type="button" data-class="prev" aria-label="Previous class">‹</button>
      <button type="button" data-class="next" aria-label="Next class">›</button>
      <div class="start-card">
        <p data-class-name>Warrior</p>
        <p data-class-role>Melee and shield. Chops faster. Kills pay gold.</p>
        <label>
          Name <input id="player-name" name="name" maxlength="16" autocomplete="nickname" required />
        </label>
        <button type="submit" id="start-button">{if @mode == "create", do: "Create", else: "Join"}</button>
        <p id="start-error" class="error" hidden></p>
      </div>
      <section :if={@mode == "create"} class="start-scores">
        <h2>High scores</h2>
        <ol id="score-list">
          <li class="empty">No keeps have fallen yet.</li>
        </ol>
      </section>
    </form>
    """
  end
end
