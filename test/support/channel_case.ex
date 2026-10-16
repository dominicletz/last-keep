defmodule LastKeepWeb.ChannelCase do
  @moduledoc false

  use ExUnit.CaseTemplate

  using do
    quote do
      @endpoint LastKeepWeb.Endpoint

      import Phoenix.ChannelTest
      import LastKeepWeb.ChannelCase
    end
  end
end
