---
layout: post
author: tom
title: Calculating IPv4 Addresses with Java Bit Shift Operators
tags: java bitshift java-ipv4 networking ipv4
---

While working on a personal project that manipulates IPv4 addresses and subnets, I ran into bit shifting as a way of 
parsing IPv4 addresses into integers. I found the concept very interesting mathematically, but, I didn't really 
understand how it worked at a deep level. Because of this, I was uncomfortable using it in my code. This is a collection
of my learnings around how exactly bit shifting can help when storing IPv4 addresses, and, the math behind it.

### IPv4 Addressing 

It's important to start with what an IPv4 (hereafter referred to as IP) Address is. An IP Address is four, 8 bit 
octets, (32 total) seperated by a '.'. Here's an example of an IP Address that likely looks familiar:

```
192.168.1.1
```

A common default gateway address in home networks. Since we know that each octet is 8 bits, we know that the maximum
value for each octet must be 255. In other words, in binary, all the 8 bits are on.

```
11111111 = 255
```

With all 8 bits on, we get 255. This also means that the largest IPv4 address looks like this:

```
11111111.11111111.11111111.11111111
```

or in decimal format:

```
255.255.255.255
```

Why do we care so much about the bits when dealing with IP Addresses? Can't we store it as `String` and call it a day?
While `String` representations are likely how we will encounter the data, they aren't of much use to us. If we store the
numerical value of the IP Address, as opposed to its `String` representation, we can perform operations on it such as sorting,
adding or subtracting to get new addresses, and more. The proper way to store an IP Address when any operations may be 
done against it is in numerical format. If textual output is required, calculate that value when necessary.


In Java, an `int` is signed. If the leftmost octet is at least `128`, there will be complications (out of scope) when
using `int` as a datatype. While this could be detected manually and reacted to, we will use the `long` datatype for 
simplicity.


Using an IP Address that would likely be found on a home network, similar to our first example. Let's use 
`192.168.1.42`. First, break this down into binary and decimal representations, per octet. 


| Decimal |         Binary         |
|:-------:|:----------------------:|
|   192   |        11000000        |
|   168   |        10101000        |
|    1    |        00000001        |
|   42    |        00101010        |


In other words, we could write this IP Address as:

```
11000000.10101000.00000001.00101010
```

Understanding this is core to moving forward. If it is unclear still, there is a myriad of resources available on 
the internet explaining how IP Addressing works at the bit level.

### Bit Shifting Operations

#### Shifting Left (String to Integer)

Now, in order to better explain shifting, lets pad all of these numbers with 24 leading zeros. We know that each IP 
address is 32 bits total, and, each octet is 8 bits. Thus, in order to represent them as 8 bits within 32 total bits,
add 24 zeroes to the left. Although this evaluates to the same decimal number now, this 'stage' of 32 total 
bits becomes more important when shifting, and pre-populating with leading zeroes makes it easier to view the shift 
operation, in my opinion.


| Decimal |               Binary                |
|:-------:|:-----------------------------------:|
|   192   | 00000000 00000000 00000000 11000000 |
|   168   | 00000000 00000000 00000000 10101000 |
|    1    | 00000000 00000000 00000000 00000001 |
|   42    | 00000000 00000000 00000000 00101010 |


Starting with the leftmost octet, 192, shift by 24 bits to the left. Repeat this for each other octet, reducing the amount
of bits shifted by 8 each time. Finally, sum these results. Here is a visual example:

```
192:                                    Decimal Equivalent
00000000 00000000 00000000 11000000 

Apply 192 << 24:
11000000 00000000 00000000 00000000     = 3221225472

-----------------------------------

168:
00000000 00000000 00000000 10101000     

Apply 168 << 16:
00000000 10101000 00000000 00000000     = 11010048

-----------------------------------

1:
00000000 00000000 00000000 00000001

Apply 1 << 8:
00000000 00000000 00000001 00000000     = 256

------------------------------------

42:
00000000 00000000 00000000 00101010     

Apply 42 << 0 (No Shift):
00000000 00000000 00000000 00101010     = 42

-----------------------------------
                              Total     = 3232235818
```

Now, after all that hard work, we have our integer (or more accurately `long`) representation of our IP Address. 
This is the value that will get stored in our class. That value is represented as the sum of each bit shift operation,
`3232235818`. 


#### Why Bit Shift?


All the information displayed so far is readily available on the internet and hardly groundbreaking. What was 
unclear to me was why we chose to bitshift and in those particular amounts. The reason that we do this is to 
enable us to evaluate each octet **individually**, but then place it on a 'stage' of 32 bits in the correct place. 
Recall that an IP Address is 32 bits, as we determined early on in this article. This allows us to hold the IP 
address as a single numerical representation while also allowing us to reconstruct it by applying shift operations 
in the **opposite** direction, and concatenating them with a dot. If you're still unclear, take a look at this example:

```
11000000 00000000 00000000 00000000
^192
00000000 10101000 00000000 00000000
         ^168
00000000 00000000 00000001 00000000
                  ^1
00000000 00000000 00000000 00101010
                           ^42
```

Here, I represent the bit shifted values as a stack. I've indicated the decimal values of the non-zero octets with a 
caret. You can see how this structure represents our IP Address octets, shifted as they were when represented in text. 
All that is missing is a dot delimiter. To further drive this point home, 192 was evaluated first as it was the leftmost 
octet in the IP Address. This means that in our IP Address, 192 represents the bits 32 (leftmost) to 24. Once 192 is 
converted to binary (`11000000`), we need to shift it into the proper bit location to be evaluated individually. 

If you're familiar with bit operations, the stacked example above may visually indicate how we can use an `OR` 
operation using the `|` operator. An OR operation will return true (in our case a 1) if either of the bits is turned 
on. Example:

| First Value | Operation | Second Value | Result |
|:-----------:|:---------:|:------------:|:------:|
|      1      |    OR     |      1       |   1    |
|      1      |    OR     |      0       |   1    |
|      0      |    OR     |      0       |   0    |


Because we shifted 8 bits in multiples of 8 (or zero), and because we shifted with no overlap, we can also OR each 
result with the next result, to get our final number. 

```
11000000 00000000 00000000 00000000     # 192
OR                                 
00000000 10101000 00000000 00000000     # 168
=
11000000 10101000 00000000 00000000     # 192 | 168
OR
00000000 00000000 00000001 00000000     # 1
=
11000000 10101000 00000001 00000000     # (192 | 168) | 1
OR
00000000 00000000 00000000 00101010     # (42)
=
11000000 10101000 00000001 00101010     # ((192 | 168) | 1 ) | 42
```

The resulting binary number `11000000101010000000000100101010` is `3232235818` in decimal, the same number we came 
out to earlier. 


#### Shifting Right (Integer to String)

Earlier, I mentioned that storing as an Integer and converting back to a String when necessary was my preferred 
approach to handling IP Addresses. How exactly do we do the second step, converting back to text?


The initial step is to simply undo our shift. As a reminder, here is our shifted and OR'd binary representation of 
192.168.1.42. I've added dots to separate the octets, making it easier to visualize as an IP Address.

```
11000000.10101000.00000001.00101010
```

Again, starting with the **leftmost octet**, let's shift that back to the right the same number of bits we 
originally shifted it to the left, 24. By using the `>>>` operator, we can guarantee that the left bits are 
filled with zeroes. 

```
11000000101010000000000100101010 >>> 24 = 00000000000000000000000011000000
^       -->            *
Move to the right 24 bits, places it at the asterisk. Value is 192.
```

Great! We have our first octet. Now, let's do the second. 

```
11000000101010000000000100101010 >>> 16 = 00000000000000001100000010101000 
^    -->       *
Move to the right 16 bits, places it at the asterisk. Value is 49320.
```

If our value is `49320`, this is clearly incorrect, so, what went wrong? If you recall, we're trying to reconstruct 
each octet of the IP address by shifting it back into its original position, and, evaluating it as a decimal. 
This said, clearly the octet for '192' is still present in the integer. If we are bound to left and right shifting,
how do we isolate this octet?

Once the shift is over, we can use a bitwise AND operation, represented by the `&` character. An AND calculation 
returns true if both of the bits are the same state, either on or off. The logic is better explained by this table:

| First Value | Operation | Second Value | Result |
|:-----------:|:---------:|:------------:|:------:|
|      1      |    AND    |      1       |   1    |
|      1      |    AND    |      0       |   0    |
|      0      |    AND    |      0       |   0    |


Since the original octet representation was only considered with the first 8 bits, we can apply an AND 
operation against 255 (the max value if all 8 bits are on, `11111111`) which effectively drops the extra octet while 
keeping the rightmost octet (the one we are evaluating) unchanged. The hex for 255 is `0xFF` and represents `11111111`.

Putting it all together:

```
00000000 00000000 11000000 10101000     # 49320
AND (&)
00000000 00000000 00000000 11111111     # 255
=
00000000 00000000 00000000 10101000     # 168
```

Now, the logic for the final address is:

```
(11000000101010000000000100101010 >>> 25) & 0xFF = 192
(11000000101010000000000100101010 >>> 16) & 0xFF = 168
(11000000101010000000000100101010 >>> 8) & 0xFF  = 1
(11000000101010000000000100101010 >>> 0) & 0xFF  = 42
```

It is simply a matter of concatenating them together in a String. In Java, a class representing an IPAddress may 
look something like this:

```java
package ca.tomjack.iputil.ipv4;

public class IPv4Address {
    private final long value;

    private IPv4Address(long value) {
        this.value = value;
    }

    public static IPv4Address from(String textualAddress) {
        String[] textualAddressSplit = textualAddress.split("\\.");

        if (textualAddressSplit.length != 4) {
            throw new IllegalArgumentException("Incorrect Format");
        }

        long total = 0;
        for (int s = 3; s >= 0; s--) {
            long octet = Long.parseLong(textualAddressSplit[3 - s]);

            if (octet > 255 || octet < 0) {
                throw new IllegalArgumentException("Incorrect Octet Value");
            }

            total |= octet << (s * 8);
        }
        return new IPv4Address(total);
    }

    public long getValue() {
        return value;
    }

    @Override
    public String toString() {
        return ((value >> 24) & 0xFF) + "." + 
               ((value >> 16) & 0xFF) + "." + 
               ((value >> 8) & 0xFF) + "." + 
               (value & 0xFF);
    }

    @Override
    public boolean equals(Object that) {
        if (this == that) {
            return true;
        }
        if (!(that instanceof IPv4Address)) {
            return false;
        }
        return this.value == ((IPv4Address) that).value;
    }

    @Override
    public int hashCode() {
        return Long.hashCode(value);
    }
}

```

Which can then be proven to follow these rules with the following unit test:

```java
package ca.tomjack.iputil;

import ca.tomjack.iputil.ipv4.IPv4Address;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class IPv4AddressTest {

    @Test
    void createIPv4Address_thenCompare () {
        IPv4Address address = IPv4Address.from("192.168.1.42");
        Assertions.assertEquals(3232235818L, address.getValue());
        Assertions.assertEquals("192.168.1.42", address.toString());
    }
}
```

Writing this article was a method to help myself better understand bit shift and bitwise operations. The content is 
an amalgamation of many web resources and I hope it proves helpful to anyone who should also be working with IPv4 
addresses stored as integers. If you find any errors in this post, please let me know using my 
[contact methods](/contact).