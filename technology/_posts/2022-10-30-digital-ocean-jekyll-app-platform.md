---
layout: post
author: tom
title: Jekyll Layout for Digital Ocean Static Sites
tags: digitalocean jekyll app-platform static-site 404 not-found
---

DigitalOcean publishes a service called their 'App Platform' which removes some infrastructure burden from running 
an application. The idea is that you point it towards a repository, it identifies what is required to run, and sets 
up (and bills you) accordingly.

<br>

One of the built-ins was static site hosting. With three free sites, that's a decent deal, considering you get free 
TLS and their caching CDN. I use Jekyll, and was having issues with 404's being served when clicking on certain 
hyperlinks.

<br>

To remediate, I had to change instances where `.html` files were being referenced directly to instead be a folder 
and an `index.html` inside that folder. This cleared up the issues linking to different sections of the website.

<br>

### Example

Problematic Configuration:

```
site-root/
index.html
contact.md   <-- Unable to link to contact.md from index.html
projects.html <-- Unable to link to projects.html from index.html
posts/
├─ sample-category/
│  ├─ sample-post.md
```
<br>
Solution:

```
site-root/
index.html
posts/
├─ sample-category/
│  ├─ sample-post.md
contact/
├─ index.md <-- renamed from contact.html
projects/
├─ index.html <-- renamed from projects.html

```

This is also demonstrated on [my GitHub](https://github.com/tajacks/personal-site/pull/1/files)