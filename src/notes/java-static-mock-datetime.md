---
layout: note.njk
title: "Mocking Static DateTime Functions"
category: Java
description: "Safely mock static DateTime functions"
tags:
  - networking
  - bitshift
  - java
created: 2023-04-11
---

Static mocks may be an indicator of a larger problem, but, are sometimes unavoidable. Commonly used static methods
are ones for receiving the current date and time, typically called `.now()`, such as `LocalDateTime.now()` or
`Instant.now()`.

When testing routines which call static methods on `DateTime` objects such as `LocalDateTime.now()`, it may be desirable
to return the same value consistently in tests (such as a fixed point in time). Do not mock the `.now()` functions
directly if `add` or `subtract` operations are necessary. Mocking static methods on these object types typically
interferes with internal static factories which construct new objects. This can cause undesirable behaviour in testing.

To consistently return the same date and time in tests, mock the `Clock` which powers these other date and time types:

```java
class DateTimeTest {

    @Test
    void canMockDate_andPerformOperationsAgainst() {
        final Clock fixedClock = Clock.fixed(Instant.EPOCH, ZoneId.of("America/New_York"));
        try (MockedStatic<Clock> mockClock = Mockito.mockStatic(Clock.class)) {
            mockClock.when(Clock::systemDefaultZone).thenReturn(fixedClock);
            assertEquals(LocalDateTime.ofInstant(Instant.EPOCH, ZoneId.of("America/New_York")), LocalDateTime.now());
            // Can add and subtract
            assertEquals(LocalDateTime.ofInstant(Instant.EPOCH, ZoneId.of("America/New_York")).plusDays(1), LocalDateTime.now().plusDays(1));
        }
    }
}
```

Ideally, the function being tested should receive either a provider for a `DateTime` object, or, a `DateTime` object
directly, instead of relying on static mocks. Unfortunately this may be unavoidable - especially when working with
legacy code.
