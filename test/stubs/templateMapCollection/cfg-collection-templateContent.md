---
title: templateContent Test
---

# {{ title }}

{% for post in collections.userCollection %}
{{ post.templateContent }}
{% endfor %}
