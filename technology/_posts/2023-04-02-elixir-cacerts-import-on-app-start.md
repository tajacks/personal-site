---
layout: post
author: tom
title: Running Functions on Elixir Application Start
tags: elixir erlang cacerts application-start import-cacerts
---

For a project I was working on, I needed a no-nonsense way to run simple code when my application, or the 
application of a user of this library, was starting. This is the simple method I came up with to run a function on 
application start. 

<br>

This particular case imports certificates into the cacert store, but it can be extended to do whatever your application
requires.

```elixir
defmodule ApplicationStart do
    use Application
    
    @cacert_path Path.join(:code.priv_dir(:myapp), "cacert.pem")
    
    # {:error, reason} is returned if there is an issue loading CA Certs, which also matches
    # the return type of the Application `start` callback
    def start(_type, _args) do
        with :ok <- :public_key.cacerts_load(@cacert_path) do   # <-- The work being done
            Supervisor.start_link([], strategy: :one_for_one)   # <-- Applications starts
        end
    end
end
```

The solution above takes advantage of the `Application.start/2` callback. In this case, I needed to run 
`:public_key.cacerts_load(@cacert_path)`. It happens that the error tuple from this operation also matches the expected 
error tuple of the start callback, but if your startup logic is more complicated, ensure that you conform to the format
expected by the callback contract.

<br>

Finally, register your module in the application function in `mix.exs`, as so:

```elixir 
  def application do
    [
      extra_applications: [:logger],
      mod: {ApplicationStart, []}    # <-- Module name where Application was implented, see above
    ]
  end
```

And that's it!