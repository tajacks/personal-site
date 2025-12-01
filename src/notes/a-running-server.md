---
layout: note.njk
title: "A Running Server"
category: Infrastructure
description: "An examination of a running server"
tags:
  - infrastructure
  - servers
created: 2025-11-30
---


<svg viewBox="0 0 400 350" class="cover-graphic" xmlns="http://www.w3.org/2000/svg">
  <title>Get it?</title>
  <!-- Gradients -->
  <defs>
    <linearGradient id="serverBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4efe7"/>
      <stop offset="100%" stop-color="#d9d3c8"/>
    </linearGradient>
    <linearGradient id="ventMetal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8a857d"/>
      <stop offset="100%" stop-color="#5e5a55"/>
    </linearGradient>
    <linearGradient id="shoe" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#b8a998"/>
      <stop offset="100%" stop-color="#8a7c69"/>
    </linearGradient>
    <linearGradient id="sole" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#73706a"/>
      <stop offset="100%" stop-color="#514e49"/>
    </linearGradient>
  </defs>

  <g transform="rotate(-12, 200, 280)">
    <!-- Server body -->
    <rect x="120" y="80" width="160" height="150" rx="6"
          fill="url(#serverBody)" stroke="#2d2a26" stroke-width="4"/>
    <rect x="128" y="88" width="144" height="134" rx="4"
          fill="none" stroke="#a19789" stroke-width="2"/>
    <!-- Face -->
    <circle cx="155" cy="130" r="9" fill="#2d2a26"/>
    <circle cx="205" cy="130" r="9" fill="#2d2a26"/>
    <path d="M160 155 Q180 165 200 155" stroke="#2d2a26" stroke-width="4" fill="none"/>
    <!-- Arms (correct running posture) -->
    <!-- Left arm UP (forward) -->
    <path d="M130 150
             Q100 145 95 120
             Q95 95 115 90"
          fill="none" stroke="#8b7d6b" stroke-width="10" stroke-linecap="round"/>
    <!-- Right arm DOWN (backward) -->
    <path d="M270 165
             Q295 185 290 215
             Q285 235 260 235"
          fill="none" stroke="#8b7d6b" stroke-width="10" stroke-linecap="round"/>
    <!-- Vents -->
    <rect x="140" y="180" width="120" height="12" fill="url(#ventMetal)" rx="2"/>
    <rect x="140" y="205" width="120" height="12" fill="url(#ventMetal)" rx="2"/>
    <!-- Legs -->
    <!-- Left leg (forward, bent) -->
    <path d="M159 230 Q135 260 155 285"
          fill="none" stroke="#9a8b79" stroke-width="18" stroke-linecap="round"/>
    <!-- Right leg (back, extended) -->
    <path d="M224 230 Q200 260 220 285"
          fill="none" stroke="#9a8b79" stroke-width="18" stroke-linecap="round"/>
    <!-- Left sneaker -->
    <g transform="translate(115,276)">
      <path d="M5 25 L18 8 Q25 3 40 5 L60 10 Q68 20 63 30 L10 32 Z"
            fill="url(#shoe)" stroke="#2d2a26" stroke-width="3"/>
      <line x1="20" y1="15" x2="35" y2="15" stroke="#f4efe7" stroke-width="2"/>
      <line x1="23" y1="21" x2="38" y2="21" stroke="#f4efe7" stroke-width="2"/>
      <path d="M8 32 L63 32 L63 40 L5 40 Z"
            fill="url(#sole)" stroke="#2d2a26" stroke-width="2"/>
    </g>
    <!-- Right sneaker -->
    <g transform="translate(180,276)">
      <path d="M5 25 L18 8 Q25 3 40 5 L60 10 Q68 20 63 30 L10 32 Z"
            fill="url(#shoe)" stroke="#2d2a26" stroke-width="3"/>
      <line x1="20" y1="15" x2="35" y2="15" stroke="#f4efe7" stroke-width="2"/>
      <line x1="23" y1="21" x2="38" y2="21" stroke="#f4efe7" stroke-width="2"/>
      <path d="M8 32 L63 32 L63 40 L5 40 Z"
            fill="url(#sole)" stroke="#2d2a26" stroke-width="2"/>
    </g>
  </g>

  <!-- Speed lines (behind the server, mid-height) -->
  <line x1="300" y1="150" x2="350" y2="150" stroke="#9a8b79" stroke-width="4" stroke-linecap="round"/>
  <line x1="325" y1="165" x2="375" y2="165" stroke="#9a8b79" stroke-width="4" stroke-linecap="round"/>
  <line x1="300" y1="180" x2="350" y2="180" stroke="#9a8b79" stroke-width="4" stroke-linecap="round"/>
</svg>