---
layout: post
author: tom
title: Right-Shifting Elixir Lists
tags: elixir lists erlang list-head shift-list list-tail
---

Lists in Elixir are linked lists. I recently had a situation where I needed to shift all elements in the 
list one to the right, bringing the last element to the list as the new first element (head).

<br>

Here are the three ways I propose to right-shift a list, bringing the last element to the new head.

<br>

#### TLDR;
If you need to shift a list to the right and bring the last element to the new head position, this seems to
be an effective way to do so, keeping in mind the linked nature of Elixir lists.

```elixir 
  def shift_non_inline(list) when is_list(list) do
    Enum.reverse(list) 
    |> shift_non_inline_helper() 
  end

  def shift_non_inline_helper([head | tail]), do: [head | Enum.reverse(tail)]
```

#### Tested Functions

```elixir 
defmodule Benchmark do
  
  ## 1 ##
  def shift(list) when is_list(list) do 
    Enum.reverse(list) 
    |> then(fn [head | tail] -> [head | Enum.reverse(tail)] end)
  end

  ## 2 ##
  def shift_non_inline(list) when is_list(list) do
    Enum.reverse(list) 
    |> shift_non_inline_helper() 
  end

  def shift_non_inline_helper([head | tail]), do: [head | Enum.reverse(tail)]

  ## 3 ##
  def shift_pop(list) when is_list(list) do
    {new_head, rest} = list |> List.pop_at(-1)
    [new_head | rest]
  end
end
```

<br>

The logic for the first two functions are identical. `shift/1` uses 
[Kernel.then/2](ttps://hexdocs.pm/elixir/main/Kernel.html#then/2) to pattern match in
the pipeline by using a function declared in the pipeline. Both the initial two first reverse the list,
get the head (original last element) of that list, and construct a new list where the head is the element
just retrieved and the tail is the remainder of the reversed list, re-reversed (back in order).

<br>

The third method uses Elixir List function. It pops the last element off the list and returns the last element
as the new head followed by the remainder.

<br>

All are very simple, but require list traversal to complete.

<br>

To test all three methods, ranges (to lists) with max sizes `100` and `10_000_000` were used. I ran the benchmarks 
using Benchee.

```elixir
list = 1..10_000_000 |> Enum.to_list()
list_small = 1..100 |> Enum.to_list()

Benchee.run (
  %{
    "shift" => fn -> Benchmark.shift(list) end,
    "shift_pop" => fn -> Benchmark.shift_pop(list) end,
    "shift_non_inline" => fn -> Benchmark.shift_non_inline(list) end,
  }
)

Benchee.run (
  %{
    "shift_small" => fn -> Benchmark.shift(list_small) end,
    "shift_pop_small" => fn -> Benchmark.shift_pop(list_small) end,
    "shift_non_inline_small" => fn -> Benchmark.shift_non_inline(list_small) end
  }
)
```

In both the small and large lists, the shift operation completed the fastest with the 
dual reverse as opposed to the pop. The method which did not use `Kernel.then()` performed better 
in both instances.

#### Large
```
Name                       ips        average  deviation         median         99th %
shift_non_inline          4.48      223.44 ms    ±35.77%      215.30 ms      453.21 ms
shift                     3.19      313.32 ms    ±76.04%      228.98 ms      907.35 ms
shift_pop                 2.97      336.72 ms    ±33.13%      339.53 ms      581.26 ms

Comparison: 
shift_non_inline          4.48
shift                     3.19 - 1.40x slower +89.88 ms
shift_pop                 2.97 - 1.51x slower +113.28 ms
```

#### Small

```
Name                             ips        average  deviation         median         99th %
shift_non_inline_small        1.50 M      668.03 ns  ±4273.35%         581 ns         985 ns
shift_small                   1.48 M      675.72 ns  ±4184.02%         584 ns        1007 ns
shift_pop_small               0.71 M     1399.05 ns  ±2227.75%        1225 ns        2016 ns

Comparison: 
shift_non_inline_small        1.50 M
shift_small                   1.48 M - 1.01x slower +7.69 ns
shift_pop_small               0.71 M - 2.09x slower +731.02 ns
```