---
layout: post
author: tom
title: Mocking Java's DateTime Static Functions
tags: java localdatetime static mockito zoneddatetime localdate mock now
---

Static mocks are sometimes necessary. You may have functions that perform date and/or time operations using 
the current time on the timeline at time of calling. Often these functions will reference the `.now()` static 
function which is present on most of the new Java time classes. Two examples I use frequently are `LocalDateTime.now()` 
and `ZonedDateTime.now()`. Due to the nature of these, writing tests which assert against known values is difficult. It 
would be much easier to write tests if we could guarantee the same time was returned for all our tests.

<br>

If you choose to mock `.now()` when testing your methods, you will run into issues when performing operations which add 
or subtract from the returned value, as an example. In order to mock calls to `.now()` while retaining the ability to 
perform operations on the returned value, we should instead mock the `Clock`: 

```java 
class SandBoxTest {

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

Using Mockito, we can leverage the try-with-resources static mock functionality. First, outside your try block, 
create a `Clock` at a fixed time. Supply it the appropriate instant and timezone. This example uses Epoch. In the 
try-with-resources block, create a new `MockedStatic<Clock>` and configure it to return your fixed clock when 
`.systemDefaultTimezone()` is called. 

<br>

And voilà! Classes which are backed by clocks can now return fixed times inside the try with resources block. This 
lets your write predictable tests for your date and time operations.