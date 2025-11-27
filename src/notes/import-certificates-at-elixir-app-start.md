---
layout: note.njk
title: "Elixir Certificate Import"
category: Elixir
description: "Importing trusted certificates during application start."
tags:
  - elixir
  - erlang
  - certificates
created: 2023-04-02
---

The Erlang function `:public_key.cacerts_load/1` can be used to load trusted CA certificates from a file,
and with any Erlang function, it can be called from Elixir. The spec for this function shows it returns either
`:ok` or a tuple of `{:error, reason}`:

```
-spec cacerts_load(File :: file:filename_all()) -> ok | {error, Reason :: term()}
```

Conveniently, the error format matches the failure state for the `Application.start` callback:

```
@callback start(start_type(), start_args :: term()) ::
  {:ok, pid()} | {:ok, pid(), state()} | {:error, reason :: term()}
```

Using the `with` keyword makes importing certificates at application start a breeze:

```elixir
defmodule ApplicationStart do
    use Application

    @cacert_path Path.join(:code.priv_dir(:myapp), "cacert.pem")

    # {:error, reason} is returned if there is an issue loading CA Certs, which also matches
    # the return type of the Application `start` callback
    def start(_type, _args) do
        with :ok <- :public_key.cacerts_load(@cacert_path) do   # <-- Importing
            Supervisor.start_link([], strategy: :one_for_one)   # <-- Applications starts
        end
    end
end
```

