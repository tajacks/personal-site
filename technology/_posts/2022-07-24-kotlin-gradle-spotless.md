---
layout: post
author: tom
title: Kotlin + Gradle w/ Kotlin DSL + Spotless
tags: kotlin gradle spotless ktlint kts linting
---

If you're using a Kotlin as your Gradle DSL and  wish to use [spotless](https://github.com/diffplug/spotless/tree/main/plugin-gradle){:target="_blank"}
in your project, you can take the following steps. You're using Kotlin as your Gradle DSL if your build file 
is `build.gradle.kts`.

### Add Spotless Plugin

Most recent version can be found [here](https://plugins.gradle.org/plugin/com.diffplug.spotless){:target="_blank"}.

```kotlin
plugins {
    kotlin("jvm") version "1.7.10"
    id("com.diffplug.spotless") version "6.7.2"
}
```

### Configure Spotless + Plugin of Choice

When using Kotlin as your DSL, you need to change the documentation on GitHub to use method calls 
and double-quoted strings.

```kotlin
configure<com.diffplug.gradle.spotless.SpotlessExtension> {
    kotlin { ktlint() }
    kotlinGradle {
        target("*.gradle.kts")
        ktlint()
    }
}
```

### Example build.gradle.kts

```kotlin
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.7.10"
    id("com.diffplug.spotless") version "6.7.2"
}

group = "your.group.id"

version = "1.0-SNAPSHOT"

repositories { mavenCentral() }

dependencies {
    testImplementation(kotlin("test"))
}

configure<com.diffplug.gradle.spotless.SpotlessExtension> {
    kotlin { ktlint() }
    kotlinGradle {
        target("*.gradle.kts")
        ktlint()
    }
}

tasks.test { useJUnitPlatform() }

tasks.withType<KotlinCompile> { kotlinOptions.jvmTarget = "1.8" }

```

In this example, I use [ktlint](https://ktlint.github.io/){:target="_blank"}. You can view supported plugins [here](https://github.com/diffplug/spotless/tree/main/plugin-gradle#kotlin=){:target="_blank"}.

<br>

That's it!