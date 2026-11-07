defmodule LastKeepWeb.RoomLayers do
  @moduledoc """
  The room's layers above the stage. The home page carries them too, hidden,
  so a new keep turns into its room without a reload.
  """
  use Phoenix.Component

  def turn_card(assigns) do
    ~H"""
    <div id="turn" hidden>
      <div class="turn-card">
        <svg data-turn-icon viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
          <rect
            x="22"
            y="6"
            width="20"
            height="34"
            rx="3"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
          </rect>
          <path d="M44 30a16 16 0 1 1-5-12" fill="none" stroke="currentColor" stroke-width="2"></path>
          <path d="M39 12h8v8" fill="none" stroke="currentColor" stroke-width="2"></path>
        </svg>
        <p>Rotate your device</p>
      </div>
    </div>
    """
  end
end
